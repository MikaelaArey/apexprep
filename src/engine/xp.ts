// XP rewards learning behaviors, never raw tapping.

import type { Difficulty } from '@/content/types';

export const XP = {
  correctBase: 10,
  difficultyMultiplier: [1, 1.25, 1.5, 2, 2.5] as const,
  /** Wrong answer whose explanation was actually read (dwell ≥ READ_MS). */
  wrongButRead: 5,
  review: 2,
  dailyGoal: 25,
  streakRepair: 10,
};

export const READ_MS = 5000;
/** Answering faster than ~4× normal reading speed earns nothing. */
const MS_PER_WORD_FLOOR = 60;
const MIN_FLOOR_MS = 3000;

export function readingFloorMs(wordCount: number): number {
  return Math.max(MIN_FLOOR_MS, wordCount * MS_PER_WORD_FLOOR);
}

export interface AttemptXpInput {
  correct: boolean;
  difficulty: Difficulty;
  answerMs: number;
  explanationMs: number;
  wordCount: number;
  /** Same item answered in the last 7 days outside of Review. */
  recentRepeat: boolean;
}

export function attemptXp(input: AttemptXpInput): number {
  if (input.recentRepeat) return 0;
  if (input.answerMs < readingFloorMs(input.wordCount)) return 0;
  if (input.correct) return Math.round(XP.correctBase * XP.difficultyMultiplier[input.difficulty - 1]);
  return input.explanationMs >= READ_MS ? XP.wrongButRead : 0;
}

/** Cumulative XP needed to reach a level: 0, 100, 300, 600, 1000, … */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export const MAX_LEVEL = 60;

export function levelFor(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level += 1;
  const floor = xpForLevel(level);
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : floor;
  return { level, into: xp - floor, span: Math.max(1, next - floor) };
}

export function levelTitle(level: number): string {
  if (level >= 50) return 'Summit';
  if (level >= 40) return 'Expert';
  if (level >= 30) return 'Strategist';
  if (level >= 20) return 'Analyst';
  if (level >= 10) return 'Contender';
  return 'Starter';
}
