import { computeStreak, repairFor, MIN_PER_DAY, REPAIR_MIN } from '@/engine/streak';
import { addDays } from '@/engine/time';

const TODAY = '2026-10-26'; // a Monday

/** Builds activity for consecutive days ending yesterday (or today). */
function days(spec: Record<string, number>) {
  return new Map(Object.entries(spec));
}

function run(activity: Map<string, number>, opts: { rest?: number | null; repaired?: string[] } = {}) {
  return computeStreak({
    activity,
    today: TODAY,
    restWeekday: opts.rest ?? null,
    repairedDays: new Set(opts.repaired ?? []),
  });
}

function streakOf(n: number, endingOffset = -1, perDay = MIN_PER_DAY) {
  const spec: Record<string, number> = {};
  for (let i = 0; i < n; i++) spec[addDays(TODAY, endingOffset - i)] = perDay;
  return spec;
}

describe('computeStreak', () => {
  it('is zero with no activity', () => {
    const s = run(new Map());
    expect(s.current).toBe(0);
    expect(s.atRisk).toBe(false);
  });

  it('counts consecutive study days and flags today at risk', () => {
    const s = run(days(streakOf(4)));
    expect(s.current).toBe(4);
    expect(s.todayDone).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  it('adds today once the daily minimum is met', () => {
    const s = run(days({ ...streakOf(4), [TODAY]: MIN_PER_DAY }));
    expect(s.current).toBe(5);
    expect(s.todayDone).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it("doesn't count days below the minimum", () => {
    const s = run(days({ ...streakOf(3), [TODAY]: MIN_PER_DAY - 1 }));
    expect(s.current).toBe(3);
    expect(s.todayCount).toBe(MIN_PER_DAY - 1);
  });

  it('breaks on a missed day with no freezes', () => {
    // Studied 4 days, missed yesterday.
    const s = run(days(streakOf(4, -2)));
    expect(s.current).toBe(0);
    expect(s.best).toBe(4);
    expect(s.repairable?.previous).toBe(4);
    expect(s.repairable?.missedDays).toEqual([addDays(TODAY, -1)]);
  });

  it('earns a freeze after 7 study days and spends it on a miss', () => {
    // 7 study days, then one missed day (yesterday).
    const s = run(days(streakOf(7, -2)));
    expect(s.current).toBe(7);
    expect(s.frozenDays).toEqual([addDays(TODAY, -1)]);
    expect(s.freezes).toBe(0);
  });

  it('banks at most two freezes', () => {
    const s = run(days(streakOf(30)));
    expect(s.freezes).toBe(2);
  });

  it('keeps the streak on the chosen rest day', () => {
    // Yesterday was Sunday (weekday 0); studied the three days before it.
    const s = run(days(streakOf(3, -2)), { rest: 0 });
    expect(s.current).toBe(3);
    expect(s.restDays).toEqual([addDays(TODAY, -1)]);
  });

  it('is not at risk on the rest day itself', () => {
    const s = computeStreak({ activity: days(streakOf(3)), today: TODAY, restWeekday: 1, repairedDays: new Set() });
    expect(s.isRestDay).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  it('offers a repair and restores the streak once repaired', () => {
    const activity = days({ ...streakOf(5, -2), [TODAY]: REPAIR_MIN });
    const broken = run(activity);
    expect(broken.current).toBe(1);
    const missed = repairFor(broken);
    expect(missed).toEqual([addDays(TODAY, -1)]);
    const repaired = run(activity, { repaired: missed! });
    expect(repaired.current).toBe(6);
  });

  it('needs a double session to repair', () => {
    const s = run(days({ ...streakOf(5, -2), [TODAY]: MIN_PER_DAY }));
    expect(s.repairable).not.toBeNull();
    expect(repairFor(s)).toBeNull();
  });

  it("doesn't offer repairs for short streaks or old breaks", () => {
    expect(run(days(streakOf(2, -2))).repairable).toBeNull();
    expect(run(days(streakOf(6, -6))).repairable).toBeNull();
  });
});
