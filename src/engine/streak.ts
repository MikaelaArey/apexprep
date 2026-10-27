// Streaks, derived entirely from daily activity counts.
//
// Rules (from the design):
// - A study day is one with at least MIN_PER_DAY retrieval attempts
//   (questions answered + cards reviewed).
// - Every 7 study days earns a freeze (up to MAX_FREEZES banked). A freeze is
//   spent automatically on a missed day.
// - One optional weekly rest day keeps the streak without adding to it.
// - A broken streak (of 3+ days) can be repaired within REPAIR_WINDOW_DAYS by
//   doing a double session; the repaired days are then treated as covered.

import { addDays, daysBetween, weekday } from './time';

export const MIN_PER_DAY = 5;
export const REPAIR_MIN = MIN_PER_DAY * 2;
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
export const REPAIR_WINDOW_DAYS = 3;

export interface StreakInput {
  /** Retrieval attempts per local day ("YYYY-MM-DD" → count). */
  activity: Map<string, number>;
  today: string;
  restWeekday: number | null;
  repairedDays: ReadonlySet<string>;
}

export interface StreakBreak {
  previous: number;
  missedDays: string[];
  /** Last day on which a repair can still be made. */
  deadline: string;
}

export interface StreakResult {
  current: number;
  best: number;
  todayCount: number;
  todayDone: boolean;
  isRestDay: boolean;
  atRisk: boolean;
  freezes: number;
  frozenDays: string[];
  restDays: string[];
  repairable: StreakBreak | null;
}

export function computeStreak({ activity, today, restWeekday, repairedDays }: StreakInput): StreakResult {
  const todayCount = activity.get(today) ?? 0;
  const todayDone = todayCount >= MIN_PER_DAY;
  const isRestDay = restWeekday !== null && weekday(today) === restWeekday;
  const result: StreakResult = {
    current: 0,
    best: 0,
    todayCount,
    todayDone,
    isRestDay,
    atRisk: false,
    freezes: 0,
    frozenDays: [],
    restDays: [],
    repairable: null,
  };

  const active = [...activity.entries()].filter(([, n]) => n > 0).map(([d]) => d).sort();
  if (active.length === 0) return result;

  let current = 0;
  let best = 0;
  let freezes = 0;
  let towardFreeze = 0;
  let lastBreak: StreakBreak | null = null;
  let open: StreakBreak | null = null; // break whose missed days are still accumulating

  for (let day = active[0]; day < today; day = addDays(day, 1)) {
    if ((activity.get(day) ?? 0) >= MIN_PER_DAY) {
      current += 1;
      best = Math.max(best, current);
      towardFreeze += 1;
      if (towardFreeze === FREEZE_EVERY) {
        freezes = Math.min(MAX_FREEZES, freezes + 1);
        towardFreeze = 0;
      }
      open = null;
      continue;
    }
    if (current === 0) {
      open?.missedDays.push(day);
      continue;
    }
    if (restWeekday !== null && weekday(day) === restWeekday) {
      result.restDays.push(day);
      continue;
    }
    if (repairedDays.has(day)) continue;
    if (freezes > 0) {
      freezes -= 1;
      result.frozenDays.push(day);
      continue;
    }
    open = { previous: current, missedDays: [day], deadline: addDays(day, REPAIR_WINDOW_DAYS) };
    lastBreak = open;
    current = 0;
    towardFreeze = 0;
  }

  if (todayDone) {
    current += 1;
    best = Math.max(best, current);
  }

  if (lastBreak && lastBreak.previous >= 3 && daysBetween(lastBreak.missedDays[0], today) <= REPAIR_WINDOW_DAYS) {
    result.repairable = lastBreak;
  }

  result.current = current;
  result.best = best;
  result.freezes = freezes;
  result.atRisk = current > 0 && !todayDone && !isRestDay;
  return result;
}

/** Days to mark as repaired if today's activity qualifies for a repair. */
export function repairFor(streak: StreakResult): string[] | null {
  if (!streak.repairable || streak.todayCount < REPAIR_MIN) return null;
  return streak.repairable.missedDays;
}
