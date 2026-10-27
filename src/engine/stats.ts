// Aggregates for the Stats tab. Everything is computed from attempts.

import type { Item, SectionId } from '@/content/types';
import { SECTIONS } from '@/content/labels';
import type { Attempt, Confidence, MissReason } from '@/data/types';
import { masteryScore, sectionKey, typeKey, type SkillRating } from './mastery';

export const READINESS_MIN = 150;

export interface SectionStats {
  section: SectionId;
  n: number;
  correct: number;
  avgMs: number;
  targetMs: number;
  mastery: number | null;
  ratedN: number;
}

export interface TypeStats {
  section: SectionId;
  type: string;
  n: number;
  correct: number;
}

export interface Leak {
  section: SectionId;
  type: string;
  n: number;
  accuracy: number;
  mastery: number;
}

export interface Stats {
  total: number;
  correct: number;
  sections: SectionStats[];
  types: TypeStats[];
  missReasons: { reason: MissReason; count: number }[];
  missesExplained: number;
  misses: number;
  calibration: { confidence: Confidence; n: number; correct: number }[];
  leaks: Leak[];
}

const REASONS: MissReason[] = ['didnt_know', 'misread', 'timing', 'changed', 'narrowed'];
const CONFIDENCE: Confidence[] = ['sure', 'unsure', 'guess'];

export function computeStats(
  attempts: readonly Attempt[],
  sections: readonly SectionId[],
  items: ReadonlyMap<string, Item>,
  ratings: ReadonlyMap<string, SkillRating>,
  now: number,
): Stats {
  const exam = sections.length ? SECTIONS[sections[0]].exam : 'LSAT';
  const sectionStats: SectionStats[] = sections.map((section) => {
    const own = attempts.filter((a) => a.section === section);
    const r = ratings.get(sectionKey(exam, section));
    return {
      section,
      n: own.length,
      correct: own.filter((a) => a.correct).length,
      avgMs: own.length ? own.reduce((s, a) => s + a.ms, 0) / own.length : 0,
      targetMs: SECTIONS[section].targetSec * 1000,
      mastery: r ? masteryScore(r, now) : null,
      ratedN: r?.n ?? 0,
    };
  });

  const typeMap = new Map<string, TypeStats>();
  for (const a of attempts) {
    const item = items.get(a.itemId);
    if (!item) continue;
    const key = `${item.section}:${item.type}`;
    const t = typeMap.get(key) ?? { section: item.section, type: item.type, n: 0, correct: 0 };
    t.n += 1;
    if (a.correct) t.correct += 1;
    typeMap.set(key, t);
  }
  const types = [...typeMap.values()].sort((a, b) => b.n - a.n);

  const misses = attempts.filter((a) => !a.correct);
  const reasonCount = new Map<MissReason, number>();
  for (const a of misses) {
    const reason = a.missReason ?? (a.changed ? 'changed' : null);
    if (reason) reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
  }
  const missReasons = REASONS.map((reason) => ({ reason, count: reasonCount.get(reason) ?? 0 })).filter((r) => r.count > 0);

  const calibration = CONFIDENCE.map((confidence) => {
    const own = attempts.filter((a) => a.confidence === confidence);
    return { confidence, n: own.length, correct: own.filter((a) => a.correct).length };
  }).filter((c) => c.n > 0);

  const leaks: Leak[] = types
    .filter((t) => t.n >= 2)
    .map((t) => {
      const r = ratings.get(typeKey(exam, t.section, t.type));
      return { section: t.section, type: t.type, n: t.n, accuracy: t.correct / t.n, mastery: r ? masteryScore(r, now) : 50 };
    })
    .filter((l) => l.accuracy < 0.85)
    .sort((a, b) => (100 - b.mastery) * SECTIONS[b.section].weight - (100 - a.mastery) * SECTIONS[a.section].weight)
    .slice(0, 3);

  return {
    total: attempts.length,
    correct: attempts.filter((a) => a.correct).length,
    sections: sectionStats,
    types,
    missReasons,
    missesExplained: [...reasonCount.values()].reduce((s, n) => s + n, 0),
    misses: misses.length,
    calibration,
    leaks,
  };
}

/** Questions per day (attempts + card reviews) for the activity calendar and streaks. */
export function activityByDay(days: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of days) map.set(d, (map.get(d) ?? 0) + 1);
  return map;
}
