import { itemMap, packFor } from '@/content';
import type { Exam, OptionId } from '@/content/types';
import { MemoryRepo } from '@/data/repo';
import type { Attempt, ScoreEntry } from '@/data/types';
import { badgeMetrics, badgeStates, newlyEarned, nextUp, type BadgeInput } from '@/engine/badges';
import { campName, floorsFor, neededToClear } from '@/engine/climb';
import { coachLine, finishEvent, reactTo, stageFor } from '@/engine/coach';
import { inBand } from '@/engine/difficulty';
import { personalBests, scoreTrend, totalFromSections, validateScore } from '@/engine/scores';
import { climbSpec } from '@/state/actions';
import { useStore } from '@/state/store';

const DAY = 86_400_000;

describe('difficulty ranking', () => {
  for (const exam of ['MCAT', 'LSAT'] as Exam[]) {
    it(`ranks every ${exam} question within its section`, () => {
      const items = packFor(exam).items;
      const sections = [...new Set(items.map((i) => i.section))];
      for (const section of sections) {
        const group = items.filter((i) => i.section === section).sort((a, b) => a.rank - b.rank);
        expect(group.map((i) => i.rank)).toEqual(group.map((_, i) => i + 1));
        // Ratings never go down as rank goes up, and neither do levels.
        for (let i = 1; i < group.length; i++) {
          expect(group[i].rating).toBeGreaterThanOrEqual(group[i - 1].rating);
          expect(group[i].difficulty).toBeGreaterThanOrEqual(group[i - 1].difficulty);
        }
        // Levels follow the percentile cuts: the top tenth is Boss.
        const boss = group.filter((i) => i.difficulty === 5).length;
        expect(Math.abs(boss - group.length * 0.1)).toBeLessThanOrEqual(1);
        expect(group[0].difficulty).toBe(1);
      }
    });
  }

  it('maps levels to drill bands', () => {
    expect([1, 2, 3, 4, 5].filter((d) => inBand(d, 'easy'))).toEqual([1, 2]);
    expect([1, 2, 3, 4, 5].filter((d) => inBand(d, 'boss'))).toEqual([5]);
    expect([1, 2, 3, 4, 5].filter((d) => inBand(d, 'any'))).toHaveLength(5);
  });
});

describe('the Climb', () => {
  const pack = packFor('MCAT');

  it('builds science floors from discrete questions in rank order', () => {
    const floors = floorsFor(pack.items, pack.passages, 'BB');
    const discrete = pack.items.filter((i) => i.section === 'BB' && i.passageId === null).sort((a, b) => a.rank - b.rank);
    expect(floors.flatMap((f) => f.itemIds)).toEqual(discrete.map((i) => i.id));
    expect(floors.every((f) => f.itemIds.length >= 5)).toBe(true);
    expect(floors[4].checkpoint).toBe(true);
    expect(floors[0].checkpoint).toBe(false);
    expect(floors.at(-1)?.summit).toBe(true);
    expect(neededToClear(floors[0])).toBe(Math.ceil(floors[0].itemIds.length * 0.7));
  });

  it('gives each CARS passage its own floor, easiest passage first', () => {
    const floors = floorsFor(pack.items, pack.passages, 'CARS');
    expect(floors.length).toBe(pack.passages.filter((p) => p.section === 'CARS').length);
    const mean = (ids: string[]) => ids.reduce((n, id) => n + itemMap.get(id)!.rating, 0) / ids.length;
    for (let i = 1; i < floors.length; i++) expect(mean(floors[i].itemIds)).toBeGreaterThanOrEqual(mean(floors[i - 1].itemIds));
    expect(floors.every((f) => f.passageId !== null)).toBe(true);
  });

  it('names camps every five floors', () => {
    expect(campName(0)).toBe('Base Camp');
    expect(campName(4)).toBe('Base Camp');
    expect(campName(5)).toBe('Pine Ridge');
  });

  describe('clearing floors', () => {
    const floors = floorsFor(pack.items, pack.passages, 'PS');
    const ctx = { exam: 'MCAT' as Exam, items: pack.items, passages: pack.passages, attempts: [], cards: [], ratings: new Map(), now: Date.now(), rng: Math.random };

    beforeEach(async () => {
      await useStore.getState().init(new MemoryRepo());
      useStore.getState().updateSettings({ onboarded: true, exam: 'MCAT', exams: ['MCAT'] });
    });

    function play(floorIndex: number, rightCount: number) {
      const floor = floors[floorIndex];
      useStore.getState().startSession(climbSpec(ctx, 'PS', floor));
      floor.itemIds.forEach((id, i) => {
        const item = itemMap.get(id)!;
        const right = item.options.find((o) => o.correct)!.id;
        const wrong = item.options.find((o) => !o.correct)!.id;
        useStore.getState().answerQuestion({ itemId: id, selected: (i < rightCount ? right : wrong) as OptionId, confidence: null, eliminated: [], changed: false, ms: 60_000 });
        useStore.getState().completeQuestion(0);
      });
      return useStore.getState().finishSession();
    }

    it('opens the next floor at 70% and pays bonus XP once', () => {
      const summary = play(0, 7);
      expect(summary?.climb).toMatchObject({ floor: 0, cleared: true, firstClear: true, needed: 7 });
      expect(useStore.getState().settings.climb['MCAT:PS']).toBe(1);
      expect(useStore.getState().xpEvents.filter((e) => e.kind === 'floor_clear')).toHaveLength(1);
      const again = play(0, 10);
      expect(again?.climb).toMatchObject({ cleared: true, firstClear: false });
      expect(useStore.getState().xpEvents.filter((e) => e.kind === 'floor_clear')).toHaveLength(1);
    });

    it('keeps the floor locked below 70%', () => {
      const summary = play(0, 6);
      expect(summary?.climb).toMatchObject({ cleared: false, firstClear: false });
      expect(useStore.getState().settings.climb['MCAT:PS'] ?? 0).toBe(0);
    });
  });
});

function attempt(itemId: string, correct: boolean, at: number, sessionId: string, mode: Attempt['mode'] = 'drill', extra: Partial<Attempt> = {}): Attempt {
  const item = itemMap.get(itemId)!;
  const d = new Date(at);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    id: `${sessionId}-${itemId}-${at}`,
    itemId,
    itemVersion: 1,
    exam: item.exam,
    section: item.section,
    at,
    day,
    mode,
    sessionId,
    selected: 'A',
    correct,
    ms: 30_000,
    confidence: null,
    eliminated: [],
    changed: false,
    missReason: null,
    xp: 0,
    ...extra,
  };
}

describe('badges', () => {
  const pack = packFor('MCAT');
  const ids = pack.items.filter((i) => i.passageId === null && i.difficulty < 5).map((i) => i.id);
  const boss = pack.items.find((i) => i.difficulty === 5)!.id;
  const base: Omit<BadgeInput, 'attempts'> = {
    exam: 'MCAT',
    reviews: [],
    items: itemMap,
    passages: pack.passages,
    sections: ['CP', 'CARS', 'BB', 'PS'],
    bestStreak: 0,
    level: 1,
    scores: [],
    target: 510,
    climbFloors: 0,
    climbSummits: 0,
  };
  const t0 = new Date(2026, 9, 3, 12).getTime(); // a Saturday at noon

  it('tracks combos, bosses, comebacks and perfect Daily 5s', () => {
    const attempts = [
      ...ids.slice(0, 5).map((id, i) => attempt(id, true, t0 + i * 1000, 's1', 'daily5')),
      attempt(ids[5], false, t0 + 10_000, 's2'),
      attempt(ids[5], true, t0 + DAY, 's3'),
      attempt(boss, true, t0 + DAY + 1000, 's3'),
    ];
    const m = badgeMetrics({ ...base, attempts });
    expect(m.bestCombo).toBe(5);
    expect(m.perfectDaily5).toBe(1);
    expect(m.comebacks).toBe(1);
    expect(m.bossWins).toBe(1);
    expect(m.weekends).toBe(1);
    expect(m.correct).toBe(7);
  });

  it('turns metrics into tiers and progress', () => {
    const attempts = ids.slice(0, 12).map((id, i) => attempt(id, true, t0 + i * 1000, 's1'));
    const states = badgeStates({ ...base, attempts });
    const correct = states.find((b) => b.def.id === 'correct')!;
    expect(correct).toMatchObject({ tier: 1, tierName: 'Bronze', next: 50, value: 12 });
    expect(correct.progress).toBeCloseTo(2 / 40);
    const combo = states.find((b) => b.def.id === 'combo')!;
    expect(combo.tier).toBe(3); // 3, 5 and 10 in a row
    expect(states.some((b) => b.def.id === 'section-LR')).toBe(false);
    expect(newlyEarned(states, new Set(['correct:1'])).map((b) => b.key)).not.toContain('correct:1');
    expect(nextUp(states, 2)).toHaveLength(2);
  });

  it('counts score milestones', () => {
    const scores: ScoreEntry[] = [
      { id: 'a', exam: 'MCAT', date: '2026-08-01', kind: 'practice', label: '', total: 500, sections: null, createdAt: 1 },
      { id: 'b', exam: 'MCAT', date: '2026-09-01', kind: 'practice', label: '', total: 498, sections: null, createdAt: 2 },
      { id: 'c', exam: 'MCAT', date: '2026-10-01', kind: 'practice', label: '', total: 511, sections: null, createdAt: 3 },
    ];
    const m = badgeMetrics({ ...base, attempts: [], scores });
    expect(m).toMatchObject({ scoresLogged: 3, personalBests: 1, goalMet: 1 });
  });
});

describe('score log', () => {
  const entry = { exam: 'MCAT' as Exam, date: '2026-10-01', total: 510, sections: { CP: 127, CARS: 126, BB: 129, PS: 128 } };

  it('adds MCAT sections into a total', () => {
    expect(totalFromSections('MCAT', entry.sections)).toBe(510);
    expect(totalFromSections('MCAT', { CP: 127 })).toBeNull();
    expect(totalFromSections('LSAT', null)).toBeNull();
  });

  it('validates scales, dates and sums', () => {
    expect(validateScore(entry, '2026-10-27')).toBeNull();
    expect(validateScore({ ...entry, total: 511 }, '2026-10-27')).toMatch(/section scores added/);
    expect(validateScore({ ...entry, sections: { ...entry.sections, CP: 133 } }, '2026-10-27')).toMatch(/118 to 132/);
    expect(validateScore({ ...entry, date: '2026-11-01' }, '2026-10-27')).toMatch(/future/);
    expect(validateScore({ exam: 'LSAT', date: '2026-10-01', total: 181, sections: null }, '2026-10-27')).toMatch(/120 to 180/);
    expect(validateScore({ exam: 'MCAT', date: '2026-10-01', total: 505, sections: null }, '2026-10-27')).toBeNull();
  });

  it('summarizes the trend toward the goal', () => {
    const list: ScoreEntry[] = [
      { id: '2', exam: 'MCAT', date: '2026-09-15', kind: 'practice', label: '', total: 503, sections: null, createdAt: 2 },
      { id: '1', exam: 'MCAT', date: '2026-08-15', kind: 'practice', label: '', total: 497, sections: null, createdAt: 1 },
      { id: 'x', exam: 'LSAT', date: '2026-08-15', kind: 'practice', label: '', total: 160, sections: null, createdAt: 1 },
    ];
    const t = scoreTrend(list, 'MCAT', 510);
    expect(t.entries.map((e) => e.id)).toEqual(['1', '2']);
    expect(t).toMatchObject({ change: 6, toGoal: 7 });
    expect(t.best?.total).toBe(503);
    expect(personalBests(list, 'MCAT')).toBe(1);
  });

  it('saves, sorts and deletes entries in settings', async () => {
    await useStore.getState().init(new MemoryRepo());
    const make = (id: string, date: string, total: number): ScoreEntry => ({ id, exam: 'MCAT', date, kind: 'practice', label: '', total, sections: null, createdAt: Date.now() });
    useStore.getState().saveScore(make('b', '2026-09-01', 505));
    useStore.getState().saveScore(make('a', '2026-08-01', 500));
    expect(useStore.getState().settings.scores.map((e) => e.id)).toEqual(['a', 'b']);
    useStore.getState().saveScore({ ...make('a', '2026-08-01', 502) });
    expect(useStore.getState().settings.scores.find((e) => e.id === 'a')?.total).toBe(502);
    useStore.getState().deleteScore('a');
    expect(useStore.getState().settings.scores.map((e) => e.id)).toEqual(['b']);
  });
});

describe('Sprout', () => {
  const moment = { correct: true, combo: 1, index: 0, boss: false, comeback: false, missedLast: false };

  it('reacts to big moments first', () => {
    expect(reactTo({ ...moment, boss: true })).toBe('boss');
    expect(reactTo({ ...moment, comeback: true })).toBe('comeback');
    expect(reactTo({ ...moment, combo: 3 })).toBe('combo');
    expect(reactTo({ ...moment, combo: 4 })).toBeNull();
    expect(reactTo({ ...moment, combo: 15 })).toBe('combo');
    expect(reactTo({ ...moment, correct: false, missedLast: true })).toBe('miss');
    expect(reactTo({ ...moment, index: 2 })).not.toBeNull();
    expect(reactTo({ ...moment, index: 1 })).toBeNull();
  });

  it('picks the same line for the same moment and fills in details', () => {
    const a = coachLine('combo', 'attempt-1', 'MCAT', { n: 5 });
    expect(coachLine('combo', 'attempt-1', 'MCAT', { n: 5 })).toEqual(a);
    expect(a.text).toContain('5');
    expect(a.mood).toBe('cheer');
    const lsat = Array.from({ length: 40 }, (_, i) => coachLine('correct', `s${i}`, 'LSAT').text);
    expect(lsat.some((t) => /benzene|Krebs|Mitochondria|synapses/.test(t))).toBe(false);
  });

  it('grows with level and sums up sessions', () => {
    expect([1, 4, 5, 10, 20, 30, 60].map(stageFor)).toEqual([0, 0, 1, 2, 3, 4, 4]);
    expect(finishEvent(9, 10)).toBe('finishGreat');
    expect(finishEvent(6, 10)).toBe('finishGood');
    expect(finishEvent(2, 10)).toBe('finishTough');
  });
});
