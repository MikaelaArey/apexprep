// Badges: achievements derived from the study record, never stored. Most badges
// have tiers (Bronze → Legend), and each shows progress toward its next tier.

import type { Exam, Item, Passage, SectionId } from '@/content/types';
import type { Attempt, Review, ScoreEntry } from '@/data/types';
import { personalBests } from './scores';
import { addDays, weekday } from './time';

export type BadgeGroup = 'Milestones' | 'Skill' | 'Sections' | 'Habits' | 'Climb' | 'Scores';

export interface Metrics {
  correct: number;
  answered: number;
  bestCombo: number;
  bossWins: number;
  hardTried: number;
  perfectDaily5: number;
  sharpSessions: number;
  comebacks: number;
  reflections: number;
  cardsReviewed: number;
  nightOwl: number;
  earlyBird: number;
  weekends: number;
  passages: number;
  sectionsTried: number;
  bestStreak: number;
  level: number;
  climbFloors: number;
  climbSummits: number;
  scoresLogged: number;
  personalBests: number;
  goalMet: number;
  sectionCorrect: Partial<Record<SectionId, number>>;
}

export interface BadgeInput {
  exam: Exam;
  /** Every attempt; only this exam's count. */
  attempts: readonly Attempt[];
  reviews: readonly Review[];
  items: ReadonlyMap<string, Item>;
  passages: readonly Passage[];
  sections: readonly SectionId[];
  bestStreak: number;
  level: number;
  scores: readonly ScoreEntry[];
  target: number;
  climbFloors: number;
  climbSummits: number;
}

export function badgeMetrics(input: BadgeInput): Metrics {
  const attempts = input.attempts.filter((a) => a.exam === input.exam).sort((a, b) => a.at - b.at);
  const sectionCorrect: Partial<Record<SectionId, number>> = {};
  const sessions = new Map<string, Attempt[]>();
  const missed = new Set<string>();
  const days = new Set<string>();
  const answeredItems = new Set<string>();
  let bestCombo = 0;
  let bossWins = 0;
  let hardTried = 0;
  let comebacks = 0;
  let reflections = 0;
  let nightOwl = 0;
  let earlyBird = 0;
  const runs = new Map<string, number>();

  for (const a of attempts) {
    const item = input.items.get(a.itemId);
    if (a.correct) sectionCorrect[a.section] = (sectionCorrect[a.section] ?? 0) + 1;
    const list = sessions.get(a.sessionId) ?? [];
    list.push(a);
    sessions.set(a.sessionId, list);
    const run = a.correct ? (runs.get(a.sessionId) ?? 0) + 1 : 0;
    runs.set(a.sessionId, run);
    bestCombo = Math.max(bestCombo, run);
    if (item && item.difficulty >= 4) hardTried += 1;
    if (item && item.difficulty === 5 && a.correct) bossWins += 1;
    if (a.correct && missed.has(a.itemId)) {
      comebacks += 1;
      missed.delete(a.itemId);
    }
    if (!a.correct) missed.add(a.itemId);
    if (a.missReason) reflections += 1;
    const hour = new Date(a.at).getHours();
    if (hour >= 22) nightOwl += 1;
    if (hour < 7) earlyBird += 1;
    days.add(a.day);
    answeredItems.add(a.itemId);
  }

  let perfectDaily5 = 0;
  let sharpSessions = 0;
  for (const list of sessions.values()) {
    const right = list.filter((a) => a.correct).length;
    if (list[0].mode === 'daily5' && list.length >= 5 && right === list.length) perfectDaily5 += 1;
    if (list.length >= 10 && right / list.length >= 0.9) sharpSessions += 1;
  }

  let weekends = 0;
  for (const day of days) if (weekday(day) === 6 && days.has(addDays(day, 1))) weekends += 1;

  const passages = input.passages.filter((p) => p.itemIds.length > 0 && p.itemIds.every((id) => answeredItems.has(id))).length;
  const scores = input.scores.filter((s) => s.exam === input.exam);

  return {
    correct: attempts.filter((a) => a.correct).length,
    answered: attempts.length,
    bestCombo,
    bossWins,
    hardTried,
    perfectDaily5,
    sharpSessions,
    comebacks,
    reflections,
    cardsReviewed: input.reviews.filter((r) => r.exam === input.exam && r.kind === 'card').length,
    nightOwl,
    earlyBird,
    weekends,
    passages,
    sectionsTried: new Set(attempts.map((a) => a.section)).size,
    bestStreak: input.bestStreak,
    level: input.level,
    climbFloors: input.climbFloors,
    climbSummits: input.climbSummits,
    scoresLogged: scores.length,
    personalBests: personalBests(scores, input.exam),
    goalMet: scores.some((s) => s.total >= input.target) ? 1 : 0,
    sectionCorrect,
  };
}

export interface BadgeDef {
  id: string;
  title: string;
  group: BadgeGroup;
  tiers: number[];
  /** What earns the next tier, e.g. "Answer 100 questions correctly". */
  goal: (n: number) => string;
  value: (m: Metrics) => number;
  exams?: Exam[];
}

const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const SECTION_BADGES: { section: SectionId; title: string; exam: Exam }[] = [
  { section: 'CP', title: 'Lab Legend', exam: 'MCAT' },
  { section: 'BB', title: 'Cell Whisperer', exam: 'MCAT' },
  { section: 'PS', title: 'Mind Reader', exam: 'MCAT' },
  { section: 'CARS', title: 'Close Reader', exam: 'MCAT' },
  { section: 'LR', title: 'Argument Ace', exam: 'LSAT' },
  { section: 'RC', title: 'Deep Reader', exam: 'LSAT' },
];

const SECTION_NAMES: Record<SectionId, string> = {
  CP: 'Chem/Phys',
  BB: 'Bio/Biochem',
  PS: 'Psych/Soc',
  CARS: 'CARS',
  LR: 'Logical Reasoning',
  RC: 'Reading Comprehension',
};

export const BADGES: BadgeDef[] = [
  { id: 'correct', title: 'Brain Gains', group: 'Milestones', tiers: [10, 50, 100, 250, 500, 1000], goal: (n) => `Answer ${s(n, 'question')} correctly`, value: (m) => m.correct },
  { id: 'answered', title: 'Question Crusher', group: 'Milestones', tiers: [25, 100, 500, 1000, 2000], goal: (n) => `Answer ${s(n, 'question')}`, value: (m) => m.answered },
  { id: 'level', title: 'Growing Up', group: 'Milestones', tiers: [5, 10, 20, 30], goal: (n) => `Reach level ${n}`, value: (m) => m.level },
  { id: 'combo', title: 'On Fire', group: 'Skill', tiers: [3, 5, 10, 20], goal: (n) => `Get ${n} right in a row`, value: (m) => m.bestCombo },
  { id: 'boss', title: 'Boss Slayer', group: 'Skill', tiers: [1, 10, 50], goal: (n) => `Beat ${s(n, 'Boss question')}`, value: (m) => m.bossWins },
  { id: 'hard', title: 'Fearless', group: 'Skill', tiers: [10, 50, 200], goal: (n) => `Take on ${s(n, 'Hard or Boss question')}`, value: (m) => m.hardTried },
  { id: 'perfect', title: 'Perfect Five', group: 'Skill', tiers: [1, 5, 25], goal: (n) => `Ace ${s(n, 'Daily 5')} with every answer right`, value: (m) => m.perfectDaily5 },
  { id: 'sharp', title: 'Sharpshooter', group: 'Skill', tiers: [1, 5, 15], goal: (n) => `Score 90% or better in ${s(n, 'session')} of 10+ questions`, value: (m) => m.sharpSessions },
  { id: 'comeback', title: 'Comeback Kid', group: 'Skill', tiers: [1, 10, 50], goal: (n) => `Get ${s(n, 'question')} right that you once missed`, value: (m) => m.comebacks },
  ...SECTION_BADGES.map(
    (b): BadgeDef => ({
      id: `section-${b.section}`,
      title: b.title,
      group: 'Sections',
      tiers: [25, 100, 250],
      goal: (n) => `Answer ${s(n, `${SECTION_NAMES[b.section]} question`)} correctly`,
      value: (m) => m.sectionCorrect[b.section] ?? 0,
      exams: [b.exam],
    }),
  ),
  { id: 'explorer', title: 'Explorer', group: 'Sections', tiers: [4], goal: () => 'Answer a question in all four sections', value: (m) => m.sectionsTried, exams: ['MCAT'] },
  { id: 'explorer-lsat', title: 'Explorer', group: 'Sections', tiers: [2], goal: () => 'Answer a question in both sections', value: (m) => m.sectionsTried, exams: ['LSAT'] },
  { id: 'passages', title: 'Page Turner', group: 'Sections', tiers: [1, 10, 30], goal: (n) => `Finish ${s(n, 'passage')}`, value: (m) => m.passages },
  { id: 'streak', title: 'Streak Keeper', group: 'Habits', tiers: [3, 7, 30, 100], goal: (n) => `Keep a ${n}-day streak`, value: (m) => m.bestStreak },
  { id: 'reflect', title: 'Self-Aware', group: 'Habits', tiers: [5, 25, 100], goal: (n) => `Tag why you missed ${s(n, 'question')}`, value: (m) => m.reflections },
  { id: 'cards', title: 'Memory Palace', group: 'Habits', tiers: [10, 50, 250], goal: (n) => `Review ${s(n, 'concept card')}`, value: (m) => m.cardsReviewed },
  { id: 'weekend', title: 'Weekend Warrior', group: 'Habits', tiers: [1, 4, 12], goal: (n) => `Study on Saturday and Sunday of ${s(n, 'weekend')}`, value: (m) => m.weekends },
  { id: 'night', title: 'Night Owl', group: 'Habits', tiers: [10], goal: (n) => `Answer ${n} questions after 10 pm`, value: (m) => m.nightOwl },
  { id: 'early', title: 'Early Bird', group: 'Habits', tiers: [10], goal: (n) => `Answer ${n} questions before 7 am`, value: (m) => m.earlyBird },
  { id: 'climb', title: 'Mountaineer', group: 'Climb', tiers: [1, 5, 15, 40], goal: (n) => `Clear ${s(n, 'Climb floor')}`, value: (m) => m.climbFloors },
  { id: 'summit', title: 'Summiteer', group: 'Climb', tiers: [1, 4], goal: (n) => `Reach the summit in ${s(n, 'section')}`, value: (m) => m.climbSummits },
  { id: 'logged', title: 'Benchmark', group: 'Scores', tiers: [1, 3, 6], goal: (n) => `Log ${s(n, 'practice test score')}`, value: (m) => m.scoresLogged },
  { id: 'pb', title: 'Personal Best', group: 'Scores', tiers: [1, 3], goal: (n) => `Beat your best score ${s(n, 'time')}`, value: (m) => m.personalBests },
  { id: 'goal', title: 'Goal Crusher', group: 'Scores', tiers: [1], goal: () => 'Log a score at or above your target', value: (m) => m.goalMet },
];

export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];

export interface BadgeState {
  def: BadgeDef;
  value: number;
  /** 0 while locked; otherwise the tier reached (1-based). */
  tier: number;
  tierName: string | null;
  /** Threshold for the next tier, or null when maxed out. */
  next: number | null;
  /** Progress from the previous threshold toward the next, 0–1. */
  progress: number;
  /** Key for "already celebrated" bookkeeping: id plus tier. */
  key: string;
}

export function badgeStates(input: BadgeInput): BadgeState[] {
  const metrics = badgeMetrics(input);
  return BADGES.filter((def) => !def.exams || def.exams.includes(input.exam)).map((def) => {
    const value = def.value(metrics);
    const tier = def.tiers.filter((t) => value >= t).length;
    const next = tier < def.tiers.length ? def.tiers[tier] : null;
    const prev = tier > 0 ? def.tiers[tier - 1] : 0;
    const progress = next === null ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev)));
    const tierName = tier === 0 ? null : def.tiers.length === 1 ? null : TIER_NAMES[tier - 1];
    return { def, value, tier, tierName, next, progress, key: `${def.id}:${tier}` };
  });
}

/** Badges reached (or upgraded) that haven't been celebrated yet. */
export function newlyEarned(states: readonly BadgeState[], seen: ReadonlySet<string>): BadgeState[] {
  return states.filter((b) => b.tier > 0 && !seen.has(b.key));
}

/** The locked or upgradable badges closest to their next tier. */
export function nextUp(states: readonly BadgeState[], n = 3): BadgeState[] {
  return states
    .filter((b) => b.next !== null)
    .sort((a, b) => b.progress - a.progress || (a.next ?? 0) - a.value - ((b.next ?? 0) - b.value))
    .slice(0, n);
}

export const tierLabel = (b: BadgeState) => (b.tierName ? `${b.def.title} · ${b.tierName}` : b.def.title);
