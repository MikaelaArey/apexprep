// Hooks for the game layer: badges, the Climb, Sprout's growth and the queue of
// celebrations still to show. Everything is derived from the study record; the
// only stored piece is which badges this device has already celebrated.

import { useCallback, useEffect, useMemo } from 'react';
import { itemMap, packFor } from '@/content';
import { EXAMS } from '@/content/labels';
import type { Exam, SectionId } from '@/content/types';
import { badgeStates, newlyEarned, type BadgeState } from '@/engine/badges';
import { climbKey, climbProgress, floorsFor, type ClimbProgress, type Floor } from '@/engine/climb';
import { nextStage, STAGES, stageFor } from '@/engine/coach';
import { useStreak, useXp } from './derived';
import { useStore } from './store';

const floorCache = new Map<Exam, Partial<Record<SectionId, Floor[]>>>();

/** Climb floors for each of the exam's sections (content is static, so this is cached). */
export function floorsByExam(exam: Exam): Partial<Record<SectionId, Floor[]>> {
  let floors = floorCache.get(exam);
  if (!floors) {
    const pack = packFor(exam);
    floors = Object.fromEntries(EXAMS[exam].sections.map((s) => [s, floorsFor(pack.items, pack.passages, s)]));
    floorCache.set(exam, floors);
  }
  return floors;
}

export interface SectionClimb {
  section: SectionId;
  floors: Floor[];
  progress: ClimbProgress;
}

export function useClimb(exam: Exam): SectionClimb[] {
  const cleared = useStore((s) => s.settings.climb);
  return useMemo(() => {
    const floors = floorsByExam(exam);
    return EXAMS[exam].sections.map((section) => {
      const list = floors[section] ?? [];
      return { section, floors: list, progress: climbProgress(cleared[climbKey(exam, section)], list) };
    });
  }, [exam, cleared]);
}

export function useBadges(exam: Exam): BadgeState[] {
  const attempts = useStore((s) => s.attempts);
  const reviews = useStore((s) => s.reviews);
  const scores = useStore((s) => s.settings.scores);
  const target = useStore((s) => s.settings.plans[exam].target);
  const climb = useClimb(exam);
  const streak = useStreak();
  const xp = useXp();
  return useMemo(
    () =>
      badgeStates({
        exam,
        attempts,
        reviews,
        items: itemMap,
        passages: packFor(exam).passages,
        sections: EXAMS[exam].sections,
        bestStreak: streak.best,
        level: xp.level,
        scores,
        target,
        climbFloors: climb.reduce((n, c) => n + c.progress.cleared, 0),
        climbSummits: climb.filter((c) => c.progress.done).length,
      }),
    [exam, attempts, reviews, scores, target, climb, streak.best, xp.level],
  );
}

export function useSproutStage() {
  const xp = useXp();
  const stage = stageFor(xp.level);
  return { level: xp.level, stage, name: STAGES[stage].name, next: nextStage(xp.level), xp };
}

const SEEN_KEY = 'badgesSeen';

/**
 * Badges earned (or upgraded) since this device last celebrated. The first time
 * this runs, everything already earned is marked as seen without a fuss.
 */
export function useNewBadges(exam: Exam): { fresh: BadgeState[]; acknowledge: (keys: string[]) => void } {
  const badges = useBadges(exam);
  const seenRaw = useStore((s) => s.meta[SEEN_KEY] as string[] | undefined);
  const setMeta = useStore((s) => s.setMeta);
  const seen = useMemo(() => new Set(seenRaw ?? []), [seenRaw]);
  const fresh = useMemo(() => (seenRaw === undefined ? [] : newlyEarned(badges, seen)), [badges, seen, seenRaw]);
  useEffect(() => {
    if (seenRaw === undefined && badges.length > 0) setMeta(SEEN_KEY, badges.filter((b) => b.tier > 0).map((b) => b.key));
  }, [seenRaw, badges, setMeta]);
  const acknowledge = useCallback(
    (keys: string[]) => {
      const current = (useStore.getState().meta[SEEN_KEY] as string[] | undefined) ?? [];
      setMeta(SEEN_KEY, [...new Set([...current, ...keys])]);
    },
    [setMeta],
  );
  return { fresh, acknowledge };
}
