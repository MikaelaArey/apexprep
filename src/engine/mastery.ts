// Mastery: an Elo-style ability estimate per skill (section, question type and
// knowledge point), updated after every answer. It fades slowly when a skill
// isn't practiced, so mastery is visibly perishable.

import type { Difficulty, Exam, Item, SectionId } from '@/content/types';
import { EXAMS } from '@/content/labels';
import type { Attempt } from '@/data/types';
import { DAY_MS } from './time';

export interface SkillRating {
  theta: number;
  n: number;
  correct: number;
  last: number;
}

export type Tier = 'new' | 'developing' | 'proficient' | 'advanced' | 'elite';

const B_FOR_DIFFICULTY = [-1.4, -0.7, 0, 0.7, 1.4];
const DECAY_DAYS = 60;
export const MIN_RATED = 5;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function itemB(difficulty: Difficulty): number {
  return B_FOR_DIFFICULTY[difficulty - 1];
}

export function guessRate(exam: Exam): number {
  return 1 / EXAMS[exam].optionCount;
}

export function pCorrect(theta: number, b: number, guess: number): number {
  return guess + (1 - guess) * sigmoid(theta - b);
}

export function updateRating(r: SkillRating | undefined, b: number, correct: boolean, at: number, guess: number): SkillRating {
  const cur = r ?? { theta: 0, n: 0, correct: 0, last: at };
  const k = Math.max(0.2, 0.8 / (1 + cur.n / 6));
  const theta = cur.theta + k * ((correct ? 1 : 0) - pCorrect(cur.theta, b, guess));
  return {
    theta: Math.max(-4, Math.min(4, theta)),
    n: cur.n + 1,
    correct: cur.correct + (correct ? 1 : 0),
    last: at,
  };
}

/** 0–100: chance of answering a medium question correctly (guessing excluded), faded by idle time. */
export function masteryScore(r: SkillRating, now: number): number {
  const idleDays = Math.max(0, (now - r.last) / DAY_MS);
  return Math.round(100 * sigmoid(r.theta * Math.exp(-idleDays / DECAY_DAYS)));
}

export function tierFor(score: number, n: number): Tier {
  if (n < MIN_RATED) return 'new';
  if (score >= 85) return 'elite';
  if (score >= 70) return 'advanced';
  if (score >= 50) return 'proficient';
  return 'developing';
}

export const TIER_LABEL: Record<Tier, string> = {
  new: 'Not enough data',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced: 'Advanced',
  elite: 'Elite',
};

export const sectionKey = (exam: Exam, section: SectionId) => `${exam}:${section}`;
export const typeKey = (exam: Exam, section: SectionId, type: string) => `${exam}:${section}:${type}`;

/** Replays attempts in time order into ratings for every skill they touch. */
export function computeRatings(attempts: readonly Attempt[], items: ReadonlyMap<string, Item>): Map<string, SkillRating> {
  const ratings = new Map<string, SkillRating>();
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  for (const a of sorted) {
    const item = items.get(a.itemId);
    if (!item) continue;
    const b = itemB(item.difficulty);
    const guess = guessRate(item.exam);
    const keys = [sectionKey(item.exam, item.section), typeKey(item.exam, item.section, item.type), ...item.knowledgePoints];
    for (const key of keys) ratings.set(key, updateRating(ratings.get(key), b, a.correct, a.at, guess));
  }
  return ratings;
}
