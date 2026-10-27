// Work that runs when the app opens or returns to the foreground: refresh the
// reminder schedule and sync with the server.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { itemMap, packFor } from '@/content';
import { typeName } from '@/content/labels';
import { computeRatings } from '@/engine/mastery';
import { seededRng } from '@/engine/random';
import { DAILY_SIZE, dueCards, weakestTypes } from '@/engine/select';
import { computeStreak } from '@/engine/streak';
import { daysUntil } from '@/engine/srs';
import { dayKey } from '@/engine/time';
import { activityFrom, useStore } from '@/state/store';
import { scheduleReminders } from './notifications';
import { syncNow } from '@/sync/sync';

export async function refreshReminders(): Promise<void> {
  const s = useStore.getState();
  if (s.status !== 'ready' || !s.settings.onboarded) return;
  const now = Date.now();
  const exam = s.settings.exam;
  const today = dayKey(now);
  const attempts = s.attempts.filter((a) => a.exam === exam);
  const streak = computeStreak({
    activity: activityFrom(s.attempts, s.reviews),
    today,
    restWeekday: s.settings.restDay,
    repairedDays: new Set(s.settings.repairedDays),
  });
  const pack = packFor(exam);
  const weak = weakestTypes({
    exam,
    items: pack.items,
    passages: pack.passages,
    attempts,
    cards: [],
    ratings: computeRatings(attempts, itemMap),
    now,
    rng: seededRng(1),
  })[0];
  await scheduleReminders({
    enabled: s.settings.reminder.enabled,
    hour: s.settings.reminder.hour,
    minute: s.settings.reminder.minute,
    exam,
    todayDone: attempts.filter((a) => a.day === today && a.mode === 'daily5').length >= DAILY_SIZE || streak.todayDone,
    streak: streak.current,
    atRisk: streak.atRisk,
    weakest: weak ? typeName(weak.type) : null,
    dueCount: dueCards(Object.values(s.cards).filter((c) => c.exam === exam), now).length,
    daysToTest: daysUntil(s.settings.plans[exam].testDate, now),
  }).catch((e) => console.warn('[apexprep] reminders', e));
}

export function useAppLifecycle(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      if (!useStore.getState().settings.onboarded) return;
      refreshReminders();
      syncNow().catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
      if (state === 'background') refreshReminders();
    });
    return () => sub.remove();
  }, [ready]);
}
