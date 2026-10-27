// Hooks that derive what screens show (streak, mastery, due reviews, today's
// progress) from the raw data in the store.

import { useEffect, useMemo, useState } from 'react';
import { itemMap, packFor } from '@/content';
import type { Exam } from '@/content/types';
import { computeRatings } from '@/engine/mastery';
import { seededRng } from '@/engine/random';
import { DAILY_SIZE, dueCards, type SelectContext } from '@/engine/select';
import { computeStreak } from '@/engine/streak';
import { daysUntil } from '@/engine/srs';
import { dayKey } from '@/engine/time';
import { levelFor } from '@/engine/xp';
import { activityFrom, studyMsOn, useStore } from './store';

/** Current time, refreshed every minute so day boundaries and due times stay current. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function useExam(): Exam {
  return useStore((s) => s.settings.exam);
}

export function useRatings() {
  const attempts = useStore((s) => s.attempts);
  return useMemo(() => computeRatings(attempts, itemMap), [attempts]);
}

export function useActivity() {
  const attempts = useStore((s) => s.attempts);
  const reviews = useStore((s) => s.reviews);
  return useMemo(() => activityFrom(attempts, reviews), [attempts, reviews]);
}

export function useStreak() {
  const activity = useActivity();
  const restDay = useStore((s) => s.settings.restDay);
  const repairedDays = useStore((s) => s.settings.repairedDays);
  const today = dayKey(useNow());
  return useMemo(
    () => computeStreak({ activity, today, restWeekday: restDay, repairedDays: new Set(repairedDays) }),
    [activity, today, restDay, repairedDays],
  );
}

export function useXp() {
  const attempts = useStore((s) => s.attempts);
  const reviews = useStore((s) => s.reviews);
  const xpEvents = useStore((s) => s.xpEvents);
  return useMemo(() => {
    const total =
      attempts.reduce((n, a) => n + a.xp, 0) + reviews.reduce((n, r) => n + r.xp, 0) + xpEvents.reduce((n, e) => n + e.amount, 0);
    return { total, ...levelFor(total) };
  }, [attempts, reviews, xpEvents]);
}

export function useExamAttempts(exam: Exam) {
  const attempts = useStore((s) => s.attempts);
  return useMemo(() => attempts.filter((a) => a.exam === exam), [attempts, exam]);
}

export function useExamCards(exam: Exam) {
  const cards = useStore((s) => s.cards);
  return useMemo(() => Object.values(cards).filter((c) => c.exam === exam), [cards, exam]);
}

export function useSelectContext(exam: Exam): SelectContext {
  const attempts = useExamAttempts(exam);
  const cards = useExamCards(exam);
  const ratings = useRatings();
  const now = useNow();
  return useMemo(() => {
    const pack = packFor(exam);
    return {
      exam,
      items: pack.items,
      passages: pack.passages,
      attempts,
      cards,
      ratings,
      now,
      rng: seededRng(Math.floor(now / 1000)),
    };
  }, [exam, attempts, cards, ratings, now]);
}

export function useDueCards(exam: Exam) {
  const cards = useExamCards(exam);
  const now = useNow();
  return useMemo(() => dueCards(cards, now), [cards, now]);
}

export function useToday(exam: Exam) {
  const attempts = useStore((s) => s.attempts);
  const reviews = useStore((s) => s.reviews);
  const goalMin = useStore((s) => s.settings.dailyGoalMin);
  const now = useNow();
  return useMemo(() => {
    const day = dayKey(now);
    const todays = attempts.filter((a) => a.day === day);
    const ms = studyMsOn(day, attempts, reviews);
    return {
      day,
      answered: todays.length,
      minutes: Math.round(ms / 60_000),
      goalMin,
      goalMet: ms >= goalMin * 60_000,
      daily5Done: todays.filter((a) => a.mode === 'daily5' && a.exam === exam).length >= DAILY_SIZE,
    };
  }, [attempts, reviews, goalMin, now, exam]);
}

export function useDaysToTest(exam: Exam): number | null {
  const testDate = useStore((s) => s.settings.plans[exam].testDate);
  const now = useNow();
  return daysUntil(testDate, now);
}
