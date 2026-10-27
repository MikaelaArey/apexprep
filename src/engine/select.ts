// Builds the question lists for each study mode.

import type { Exam, Item, Passage, SectionId } from '@/content/types';
import { SECTIONS } from '@/content/labels';
import type { Attempt, CardRow } from '@/data/types';
import { masteryScore, typeKey, type SkillRating } from './mastery';
import { shuffle, type Rng } from './random';
import { DAY_MS, endOfDay } from './time';

export const DAILY_SIZE = 5;
const RETEST_GAP_MS = 3 * DAY_MS;
const MAX_REVIEW_TASKS = 20;

export interface SelectContext {
  exam: Exam;
  items: readonly Item[];
  passages: readonly Passage[];
  attempts: readonly Attempt[];
  cards: readonly CardRow[];
  ratings: ReadonlyMap<string, SkillRating>;
  now: number;
  rng: Rng;
}

export interface History {
  lastSeen: Map<string, number>;
  seen: Map<string, number>;
}

export function historyFrom(attempts: readonly Attempt[]): History {
  const lastSeen = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const a of attempts) {
    lastSeen.set(a.itemId, Math.max(lastSeen.get(a.itemId) ?? 0, a.at));
    seen.set(a.itemId, (seen.get(a.itemId) ?? 0) + 1);
  }
  return { lastSeen, seen };
}

/** Unseen items first (in random order), then the least recently seen. */
function freshestFirst(items: readonly Item[], history: History, rng: Rng): Item[] {
  const unseen = shuffle(items.filter((i) => !history.lastSeen.has(i.id)), rng);
  const seen = items
    .filter((i) => history.lastSeen.has(i.id))
    .sort((a, b) => history.lastSeen.get(a.id)! - history.lastSeen.get(b.id)!);
  return [...unseen, ...seen];
}

export interface WeakSpot {
  section: SectionId;
  type: string;
  score: number;
  n: number;
}

export function weakestTypes(ctx: SelectContext, limit = 3, minAttempts = 2): WeakSpot[] {
  const types = new Map<string, { section: SectionId; type: string }>();
  for (const item of ctx.items) types.set(typeKey(ctx.exam, item.section, item.type), { section: item.section, type: item.type });
  const spots: WeakSpot[] = [];
  for (const [key, t] of types) {
    const r = ctx.ratings.get(key);
    if (!r || r.n < minAttempts) continue;
    spots.push({ ...t, score: masteryScore(r, ctx.now), n: r.n });
  }
  // Weight by how much the section counts on the real exam.
  return spots
    .sort((a, b) => (100 - b.score) * SECTIONS[b.section].weight - (100 - a.score) * SECTIONS[a.section].weight)
    .slice(0, limit);
}

export function dueCards(cards: readonly CardRow[], now: number): CardRow[] {
  const cutoff = endOfDay(now);
  return cards.filter((c) => c.card.due <= cutoff).sort((a, b) => a.card.due - b.card.due);
}

function retestCandidate(kpId: string, ctx: SelectContext, history: History, exclude: Set<string>, discreteOnly: boolean): Item | null {
  const options = ctx.items.filter(
    (i) =>
      i.knowledgePoints.includes(kpId) &&
      !exclude.has(i.id) &&
      (!discreteOnly || i.passageId === null) &&
      ctx.now - (history.lastSeen.get(i.id) ?? 0) >= RETEST_GAP_MS,
  );
  return freshestFirst(options, history, ctx.rng)[0] ?? null;
}

/** Daily 5: due re-tests, then the weakest skill, then new questions. Standalone questions only. */
export function buildDaily5(ctx: SelectContext): string[] {
  const history = historyFrom(ctx.attempts);
  const discrete = ctx.items.filter((i) => i.passageId === null);
  const picked: Item[] = [];
  const used = new Set<string>();
  const take = (item: Item | null | undefined) => {
    if (item && !used.has(item.id) && picked.length < DAILY_SIZE) {
      picked.push(item);
      used.add(item.id);
    }
  };

  for (const card of dueCards(ctx.cards, ctx.now).slice(0, 2)) {
    take(retestCandidate(card.kpId, ctx, history, used, true));
  }

  const weak = weakestTypes(ctx, 1)[0];
  if (weak) {
    const ofType = discrete.filter((i) => i.type === weak.type && i.section === weak.section);
    for (const item of freshestFirst(ofType, history, ctx.rng).slice(0, 2)) take(item);
  }

  // Fill with fresh questions, spreading across sections by exam weight.
  const bySection = new Map<SectionId, Item[]>();
  for (const item of freshestFirst(discrete, history, ctx.rng)) {
    if (used.has(item.id)) continue;
    const list = bySection.get(item.section) ?? [];
    list.push(item);
    bySection.set(item.section, list);
  }
  while (picked.length < DAILY_SIZE && bySection.size > 0) {
    const sections = [...bySection.keys()];
    const total = sections.reduce((s, sec) => s + SECTIONS[sec].weight, 0);
    let roll = ctx.rng() * total;
    let chosen = sections[sections.length - 1];
    for (const sec of sections) {
      roll -= SECTIONS[sec].weight;
      if (roll <= 0) {
        chosen = sec;
        break;
      }
    }
    const list = bySection.get(chosen)!;
    take(list.shift());
    if (list.length === 0) bySection.delete(chosen);
  }
  return picked.map((i) => i.id);
}

export type DifficultyBand = 'any' | 'easy' | 'medium' | 'hard';

export interface DrillFilters {
  sections: SectionId[];
  types: string[];
  difficulty: DifficultyBand;
  count: number;
}

const inBand = (d: number, band: DifficultyBand) =>
  band === 'any' || (band === 'easy' && d <= 2) || (band === 'medium' && d === 3) || (band === 'hard' && d >= 4);

export function drillPool(ctx: SelectContext, f: Omit<DrillFilters, 'count'>): Item[] {
  return ctx.items.filter(
    (i) =>
      (f.sections.length === 0 || f.sections.includes(i.section)) &&
      (f.types.length === 0 || f.types.includes(i.type)) &&
      inBand(i.difficulty, f.difficulty),
  );
}

/** Keeps questions from the same passage together, in passage order. */
function groupPassages(items: Item[]): Item[] {
  const out: Item[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    if (placed.has(item.id)) continue;
    if (item.passageId === null) {
      out.push(item);
      placed.add(item.id);
      continue;
    }
    const group = items.filter((i) => i.passageId === item.passageId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const g of group) {
      out.push(g);
      placed.add(g.id);
    }
  }
  return out;
}

export function buildDrill(ctx: SelectContext, f: DrillFilters): string[] {
  const history = historyFrom(ctx.attempts);
  const pool = drillPool(ctx, f);
  const chosen: Item[] = [];
  const taken = new Set<string>();
  for (const item of freshestFirst(pool, history, ctx.rng)) {
    if (chosen.length >= f.count) break;
    if (taken.has(item.id)) continue;
    // A passage comes with all of its matching questions, so it's only read once.
    const group = item.passageId === null ? [item] : pool.filter((i) => i.passageId === item.passageId);
    for (const g of group) {
      taken.add(g.id);
      chosen.push(g);
    }
  }
  return groupPassages(chosen).map((i) => i.id);
}

export function passageItems(ctx: Pick<SelectContext, 'items'>, passageId: string): string[] {
  return ctx.items
    .filter((i) => i.passageId === passageId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => i.id);
}

export interface PassageProgress {
  passage: Passage;
  answered: number;
  correct: number;
  total: number;
}

export function passageProgress(ctx: Pick<SelectContext, 'passages' | 'attempts'>): PassageProgress[] {
  return ctx.passages.map((passage) => {
    const latest = new Map<string, boolean>();
    for (const a of [...ctx.attempts].sort((x, y) => x.at - y.at)) {
      if (passage.itemIds.includes(a.itemId)) latest.set(a.itemId, a.correct);
    }
    return {
      passage,
      answered: latest.size,
      correct: [...latest.values()].filter(Boolean).length,
      total: passage.itemIds.length,
    };
  });
}

/** Picks the passage to suggest next: one not started, else the least recently practiced. */
export function nextPassage(ctx: SelectContext, sections?: SectionId[]): Passage | null {
  const history = historyFrom(ctx.attempts);
  const pool = ctx.passages.filter((p) => !sections || sections.includes(p.section));
  const last = (p: Passage) => Math.max(0, ...p.itemIds.map((id) => history.lastSeen.get(id) ?? 0));
  const fresh = pool.filter((p) => last(p) === 0);
  if (fresh.length) return shuffle(fresh, ctx.rng)[0];
  return [...pool].sort((a, b) => last(a) - last(b))[0] ?? null;
}

export interface ReviewTask {
  kpId: string;
  kind: 'question' | 'card';
  itemId: string | null;
}

/** Due knowledge points, each as a fresh question when one is available, else as its concept card. */
export function buildReviewQueue(ctx: SelectContext): ReviewTask[] {
  const history = historyFrom(ctx.attempts);
  const used = new Set<string>();
  return dueCards(ctx.cards, ctx.now)
    .slice(0, MAX_REVIEW_TASKS)
    .map((card) => {
      const item = retestCandidate(card.kpId, ctx, history, used, true);
      if (item) {
        used.add(item.id);
        return { kpId: card.kpId, kind: 'question' as const, itemId: item.id };
      }
      return { kpId: card.kpId, kind: 'card' as const, itemId: null };
    });
}

/** Questions answered wrongly with "Sure" that haven't since been answered correctly. */
export function misconceptions(attempts: readonly Attempt[]): Attempt[] {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const open = new Map<string, Attempt>();
  for (const a of sorted) {
    if (!a.correct && a.confidence === 'sure') open.set(a.itemId, a);
    else if (a.correct) open.delete(a.itemId);
  }
  return [...open.values()].sort((a, b) => b.at - a.at);
}
