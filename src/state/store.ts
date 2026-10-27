// App state. Data lives in SQLite (via the Repo); this store holds it in memory,
// applies the learning rules on every answer, and persists each change.

import { create } from 'zustand';
import { itemMap, wordCount } from '@/content';
import type { Exam, OptionId } from '@/content/types';
import type { Repo, UserData } from '@/data/repo';
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type CardRow,
  type Confidence,
  type MissReason,
  type Rating,
  type Review,
  type ScoreEntry,
  type Settings,
  type XpEvent,
} from '@/data/types';
import { floorXp, PASS_RATE } from '@/engine/climb';
import { uuidv7 } from '@/engine/ids';
import { computeStreak, repairFor } from '@/engine/streak';
import { daysUntil, newCard, ratingForAttempt, reviewCard } from '@/engine/srs';
import { dayKey, DAY_MS, endOfDay } from '@/engine/time';
import { attemptXp, READ_MS, XP } from '@/engine/xp';
import type { ActiveSession, SessionSummary, SessionTask } from './session-types';

export interface StoreState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  settings: Settings;
  attempts: Attempt[];
  reviews: Review[];
  cards: Record<string, CardRow>;
  xpEvents: XpEvent[];
  session: ActiveSession | null;
  lastSummary: SessionSummary | null;
  meta: Record<string, unknown>;
}

export interface StartSpec {
  kind: ActiveSession['kind'];
  exam: Exam;
  title: string;
  tasks: SessionTask[];
  climb?: ActiveSession['climb'];
}

export interface AnswerInput {
  itemId: string;
  selected: OptionId;
  confidence: Confidence | null;
  eliminated: OptionId[];
  changed: boolean;
  ms: number;
}

interface StoreActions {
  /** Loads already-read data (used at startup with the synchronous SQLite open). */
  hydrate(repo: Repo, data: UserData): void;
  init(repo: Repo): Promise<void>;
  reload(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  startSession(spec: StartSpec): void;
  answerQuestion(input: AnswerInput): Attempt;
  completeQuestion(explanationMs: number): void;
  setMissReason(attemptId: string, reason: MissReason | null): void;
  addToReview(kpId: string): void;
  rateCard(kpId: string, rating: Rating, ms: number): void;
  finishSession(): SessionSummary | null;
  abandonSession(): void;
  setMeta(key: string, value: unknown): void;
  /** Adds a logged test score, or replaces the entry with the same id. */
  saveScore(entry: ScoreEntry): void;
  deleteScore(id: string): void;
  /** Erases all progress. `keep` sets settings to start from (used to stay onboarded). */
  resetProgress(keep?: Partial<Settings>): Promise<void>;
}

export type Store = StoreState & StoreActions;

let repo: Repo | null = null;
let writes: Promise<unknown> = Promise.resolve();

/** Serializes writes so they land in the order they happened. */
function persist(task: (r: Repo) => Promise<unknown>) {
  if (!repo) return;
  const r = repo;
  writes = writes.then(() => task(r)).catch((e) => console.warn('[apexprep] save failed', e));
}

export function flushWrites(): Promise<unknown> {
  return writes;
}

export function getRepo(): Repo | null {
  return repo;
}

const initialState: StoreState = {
  status: 'loading',
  error: null,
  settings: DEFAULT_SETTINGS,
  attempts: [],
  reviews: [],
  cards: {},
  xpEvents: [],
  session: null,
  lastSummary: null,
  meta: {},
};

/** Retrieval attempts per day: answered questions plus concept cards reviewed. */
export function activityFrom(attempts: readonly Attempt[], reviews: readonly Review[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of attempts) map.set(a.day, (map.get(a.day) ?? 0) + 1);
  for (const r of reviews) if (r.kind === 'card') map.set(r.day, (map.get(r.day) ?? 0) + 1);
  return map;
}

export function studyMsOn(day: string, attempts: readonly Attempt[], reviews: readonly Review[]): number {
  let ms = 0;
  for (const a of attempts) if (a.day === day) ms += a.ms;
  for (const r of reviews) if (r.day === day && r.kind === 'card') ms += r.ms;
  return ms;
}

export const useStore = create<Store>()((set, get) => ({
  ...initialState,

  hydrate(r, data) {
    repo = r;
    set({
      status: 'ready',
      error: null,
      settings: data.settings,
      attempts: data.attempts,
      reviews: data.reviews,
      cards: Object.fromEntries(data.cards.map((c) => [c.kpId, c])),
      xpEvents: data.xpEvents,
      session: data.session,
      meta: data.meta,
    });
  },

  async init(r) {
    try {
      get().hydrate(r, await r.load());
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  async reload() {
    if (!repo) return;
    await flushWrites();
    const data = await repo.load();
    set({
      settings: data.settings,
      attempts: data.attempts,
      reviews: data.reviews,
      cards: Object.fromEntries(data.cards.map((c) => [c.kpId, c])),
      xpEvents: data.xpEvents,
    });
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    persist((r) => r.saveSettings(settings));
  },

  startSession(spec) {
    const session: ActiveSession = {
      id: uuidv7(),
      kind: spec.kind,
      exam: spec.exam,
      title: spec.title,
      tasks: spec.tasks,
      index: 0,
      results: [],
      startedAt: Date.now(),
      current: null,
      ...(spec.climb ? { climb: spec.climb } : {}),
    };
    set({ session, lastSummary: null });
    persist((r) => r.saveSession(session));
  },

  answerQuestion(input) {
    const state = get();
    const item = itemMap.get(input.itemId);
    if (!item) throw new Error(`Unknown question ${input.itemId}`);
    const now = Date.now();
    const correct = item.options.find((o) => o.id === input.selected)?.correct ?? false;
    const inReview = state.session?.kind === 'review';
    const recentRepeat = !inReview && state.attempts.some((a) => a.itemId === item.id && now - a.at < 7 * DAY_MS);
    const xp = correct
      ? attemptXp({ correct, difficulty: item.difficulty, answerMs: input.ms, explanationMs: 0, wordCount: wordCount(item), recentRepeat })
      : 0;

    const attempt: Attempt = {
      id: uuidv7(now),
      itemId: item.id,
      itemVersion: item.version,
      exam: item.exam,
      section: item.section,
      at: now,
      day: dayKey(now),
      mode: state.session?.kind ?? 'drill',
      sessionId: state.session?.id ?? 'none',
      selected: input.selected,
      correct,
      ms: input.ms,
      confidence: input.confidence,
      eliminated: input.eliminated,
      changed: input.changed,
      missReason: null,
      xp,
    };

    // A question on a knowledge point counts as a review of it. Misses and
    // unsure answers add the concept to the review deck.
    const rating = ratingForAttempt(correct, input.confidence);
    const daysToExam = daysUntil(state.settings.plans[item.exam].testDate, now);
    const cards = { ...state.cards };
    const newReviews: Review[] = [];
    const cardsAdded: string[] = [];
    for (const kpId of item.knowledgePoints) {
      const existing = cards[kpId];
      const add = !existing && rating < 3;
      const review = existing && (rating === 1 || existing.card.due <= endOfDay(now));
      if (!add && !review) continue;
      cards[kpId] = {
        kpId,
        exam: item.exam,
        card: reviewCard(existing?.card ?? newCard(now), rating, now, daysToExam),
        source: existing?.source ?? (correct ? 'unsure' : 'miss'),
        addedAt: existing?.addedAt ?? now,
        updatedAt: now,
      };
      newReviews.push({ id: uuidv7(now), kpId, exam: item.exam, at: now, day: attempt.day, rating, kind: 'question', itemId: item.id, ms: input.ms, xp: 0 });
      if (add) cardsAdded.push(kpId);
    }

    const session = state.session ? { ...state.session, current: { attemptId: attempt.id, cardsAdded } } : null;
    set({ attempts: [...state.attempts, attempt], cards, reviews: [...state.reviews, ...newReviews], session });
    persist(async (r) => {
      await r.addAttempt(attempt);
      for (const rev of newReviews) await r.addReview(rev);
      for (const kpId of new Set(newReviews.map((x) => x.kpId))) await r.putCard(cards[kpId]);
      if (session) await r.saveSession(session);
    });
    return attempt;
  },

  completeQuestion(explanationMs) {
    const state = get();
    const session = state.session;
    if (!session?.current) return;
    const idx = state.attempts.findIndex((a) => a.id === session.current!.attemptId);
    const attempts = [...state.attempts];
    let attempt = attempts[idx];
    if (attempt && !attempt.correct && attempt.xp === 0 && explanationMs >= READ_MS) {
      const inReview = session.kind === 'review';
      const repeat = !inReview && attempts.some((a) => a.itemId === attempt.itemId && a.id !== attempt.id && attempt.at - a.at < 7 * DAY_MS);
      if (!repeat) {
        attempt = { ...attempt, xp: XP.wrongButRead };
        attempts[idx] = attempt;
        persist((r) => r.updateAttempt(attempt));
      }
    }
    const task = session.tasks[session.index];
    const next: ActiveSession = {
      ...session,
      index: session.index + 1,
      current: null,
      results: [
        ...session.results,
        {
          kind: 'question',
          itemId: task?.kind === 'question' ? task.itemId : attempt?.itemId,
          kpId: task?.kind === 'question' ? task.reviewKp : undefined,
          attemptId: attempt?.id,
          correct: attempt?.correct,
          xp: attempt?.xp ?? 0,
          ms: attempt?.ms ?? 0,
          cardsAdded: session.current.cardsAdded,
        },
      ],
    };
    set({ attempts, session: next });
    persist((r) => r.saveSession(next));
  },

  setMissReason(attemptId, reason) {
    const attempts = get().attempts.map((a) => (a.id === attemptId ? { ...a, missReason: reason } : a));
    const updated = attempts.find((a) => a.id === attemptId);
    set({ attempts });
    if (updated) persist((r) => r.updateAttempt(updated));
  },

  addToReview(kpId) {
    const state = get();
    if (state.cards[kpId]) return;
    const exam = kpId.startsWith('kp-mcat') || kpId.startsWith('kp-cars') ? 'MCAT' : 'LSAT';
    const now = Date.now();
    const row: CardRow = { kpId, exam, card: { ...newCard(now), due: now + DAY_MS }, source: 'manual', addedAt: now, updatedAt: now };
    set({ cards: { ...state.cards, [kpId]: row } });
    persist((r) => r.putCard(row));
  },

  rateCard(kpId, rating, ms) {
    const state = get();
    const existing = state.cards[kpId];
    if (!existing) return;
    const now = Date.now();
    const daysToExam = daysUntil(state.settings.plans[existing.exam].testDate, now);
    const row: CardRow = { ...existing, card: reviewCard(existing.card, rating, now, daysToExam), updatedAt: now };
    const review: Review = { id: uuidv7(now), kpId, exam: existing.exam, at: now, day: dayKey(now), rating, kind: 'card', itemId: null, ms, xp: XP.review };
    const session = state.session
      ? {
          ...state.session,
          index: state.session.index + 1,
          results: [...state.session.results, { kind: 'card' as const, kpId, rating, xp: XP.review, ms, cardsAdded: [] }],
        }
      : null;
    set({ cards: { ...state.cards, [kpId]: row }, reviews: [...state.reviews, review], session });
    persist(async (r) => {
      await r.putCard(row);
      await r.addReview(review);
      if (session) await r.saveSession(session);
    });
  },

  finishSession() {
    const state = get();
    const session = state.session;
    if (!session) return null;
    const now = Date.now();
    const today = dayKey(now);
    const xpEvents: XpEvent[] = [];
    let settings = state.settings;

    const goalMs = settings.dailyGoalMin * 60_000;
    const goalAlready = state.xpEvents.some((e) => e.kind === 'daily_goal' && e.day === today);
    const dailyGoalReached = !goalAlready && studyMsOn(today, state.attempts, state.reviews) >= goalMs;
    if (dailyGoalReached) xpEvents.push({ id: uuidv7(now), at: now, day: today, kind: 'daily_goal', amount: XP.dailyGoal });

    const streak = computeStreak({
      activity: activityFrom(state.attempts, state.reviews),
      today,
      restWeekday: settings.restDay,
      repairedDays: new Set(settings.repairedDays),
    });
    const repaired = repairFor(streak);
    if (repaired) {
      settings = { ...settings, repairedDays: [...new Set([...settings.repairedDays, ...repaired])] };
      xpEvents.push({ id: uuidv7(now), at: now, day: today, kind: 'streak_repair', amount: XP.streakRepair });
    }

    const questionResults = session.results.filter((r) => r.kind === 'question');

    // Climb floors clear at 70% correct, with every question answered. Clearing the
    // next floor for the first time opens the one above and earns bonus XP.
    let climb: SessionSummary['climb'];
    if (session.climb) {
      const { key, floor, checkpoint } = session.climb;
      const total = session.tasks.filter((t) => t.kind === 'question').length;
      const right = questionResults.filter((r) => r.correct).length;
      const needed = Math.ceil(total * PASS_RATE);
      const cleared = questionResults.length === total && right >= needed;
      const reached = settings.climb[key] ?? 0;
      const firstClear = cleared && floor === reached;
      if (firstClear) {
        settings = { ...settings, climb: { ...settings.climb, [key]: reached + 1 } };
        xpEvents.push({ id: uuidv7(now), at: now, day: today, kind: 'floor_clear', amount: floorXp({ checkpoint }), ref: `${key}:${floor}` });
      }
      climb = { key, floor, checkpoint, cleared, needed, firstClear };
    }

    const futureDue = Object.values(state.cards)
      .map((c) => c.card.due)
      .filter((d) => d > now);
    const summary: SessionSummary = {
      sessionId: session.id,
      kind: session.kind,
      exam: session.exam,
      title: session.title,
      questions: questionResults.length,
      correct: questionResults.filter((r) => r.correct).length,
      cardsReviewed: session.results.filter((r) => r.kind === 'card').length,
      cardsAdded: session.results.reduce((n, r) => n + r.cardsAdded.length, 0),
      xp: session.results.reduce((n, r) => n + r.xp, 0) + xpEvents.reduce((n, e) => n + e.amount, 0),
      ms: session.results.reduce((n, r) => n + r.ms, 0),
      dailyGoalReached,
      streakRepaired: Boolean(repaired),
      nextReviewAt: futureDue.length ? Math.min(...futureDue) : null,
      ...(climb ? { climb } : {}),
    };

    set({ session: null, lastSummary: summary, xpEvents: [...state.xpEvents, ...xpEvents], settings });
    persist(async (r) => {
      for (const e of xpEvents) await r.addXpEvent(e);
      if (settings !== state.settings) await r.saveSettings(settings);
      await r.saveSession(null);
    });
    return summary;
  },

  abandonSession() {
    set({ session: null });
    persist((r) => r.saveSession(null));
  },

  setMeta(key, value) {
    set({ meta: { ...get().meta, [key]: value } });
    persist((r) => r.setMeta(key, value));
  },

  saveScore(entry) {
    const others = get().settings.scores.filter((e) => e.id !== entry.id);
    const scores = [...others, entry].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    get().updateSettings({ scores });
  },

  deleteScore(id) {
    get().updateSettings({ scores: get().settings.scores.filter((e) => e.id !== id) });
  },

  async resetProgress(keep) {
    if (!repo) return;
    await flushWrites();
    await repo.reset();
    const settings = { ...DEFAULT_SETTINGS, ...keep };
    set({ ...initialState, status: 'ready', settings });
    if (keep) persist((r) => r.saveSettings(settings));
  },
}));
