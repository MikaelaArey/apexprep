// Logged test scores: the rules for each exam's score scale, validation, and the
// trend shown on the score history screen.

import type { Exam, SectionId } from '@/content/types';
import type { ScoreEntry } from '@/data/types';

export interface ScoreRules {
  total: { min: number; max: number };
  sections: SectionId[];
  section: { min: number; max: number } | null;
}

export const SCORE_RULES: Record<Exam, ScoreRules> = {
  MCAT: { total: { min: 472, max: 528 }, sections: ['CP', 'CARS', 'BB', 'PS'], section: { min: 118, max: 132 } },
  LSAT: { total: { min: 120, max: 180 }, sections: [], section: null },
};

/** The MCAT total is the sum of its four section scores. */
export function totalFromSections(exam: Exam, sections: Partial<Record<SectionId, number>> | null): number | null {
  const rules = SCORE_RULES[exam];
  if (!sections || rules.sections.length === 0) return null;
  const values = rules.sections.map((s) => sections[s]);
  if (values.some((v) => v === undefined)) return null;
  return values.reduce<number>((n, v) => n + (v ?? 0), 0);
}

/** An error message, or null when the entry is valid. */
export function validateScore(entry: Pick<ScoreEntry, 'exam' | 'date' | 'total' | 'sections'>, today: string): string | null {
  const rules = SCORE_RULES[entry.exam];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return 'Pick the date you took the test.';
  if (entry.date > today) return 'The test date can’t be in the future.';
  if (!Number.isInteger(entry.total) || entry.total < rules.total.min || entry.total > rules.total.max) {
    return `${entry.exam} totals run from ${rules.total.min} to ${rules.total.max}.`;
  }
  if (entry.sections && rules.section) {
    for (const s of rules.sections) {
      const v = entry.sections[s];
      if (v === undefined) continue;
      if (!Number.isInteger(v) || v < rules.section.min || v > rules.section.max) {
        return `Section scores run from ${rules.section.min} to ${rules.section.max}.`;
      }
    }
    const sum = totalFromSections(entry.exam, entry.sections);
    if (sum !== null && sum !== entry.total) return 'The total should equal the four section scores added together.';
  }
  return null;
}

export interface ScoreTrend {
  entries: ScoreEntry[];
  latest: ScoreEntry | null;
  best: ScoreEntry | null;
  first: ScoreEntry | null;
  /** Points gained from the first logged score to the latest. */
  change: number | null;
  /** Points still needed to reach the target from the best score (0 when reached). */
  toGoal: number | null;
}

export function scoreTrend(all: readonly ScoreEntry[], exam: Exam, target: number): ScoreTrend {
  const entries = all.filter((e) => e.exam === exam).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const latest = entries.at(-1) ?? null;
  const first = entries[0] ?? null;
  const best = entries.reduce<ScoreEntry | null>((b, e) => (!b || e.total > b.total ? e : b), null);
  return {
    entries,
    latest,
    best,
    first,
    change: latest && first && entries.length > 1 ? latest.total - first.total : null,
    toGoal: best ? Math.max(0, target - best.total) : null,
  };
}

/** Count of entries that beat every earlier entry (excluding the very first). */
export function personalBests(all: readonly ScoreEntry[], exam: Exam): number {
  const entries = all.filter((e) => e.exam === exam).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  let best = -Infinity;
  let count = 0;
  entries.forEach((e, i) => {
    if (e.total > best) {
      if (i > 0) count += 1;
      best = e.total;
    }
  });
  return count;
}
