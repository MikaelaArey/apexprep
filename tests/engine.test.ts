import { allItems, itemMap, packFor } from '@/content';
import type { Attempt } from '@/data/types';
import { computeRatings, masteryScore, tierFor, typeKey, updateRating } from '@/engine/mastery';
import { seededRng } from '@/engine/random';
import { buildDaily5, buildDrill, buildReviewQueue, misconceptions, DAILY_SIZE, type SelectContext } from '@/engine/select';
import { bucketFor, newCard, ratingForAttempt, reviewCard } from '@/engine/srs';
import { computeStats } from '@/engine/stats';
import { DAY_MS, dayKey } from '@/engine/time';
import { attemptXp, levelFor, xpForLevel } from '@/engine/xp';
import { uuidv7 } from '@/engine/ids';

const NOW = new Date(2026, 9, 26, 9, 0).getTime();

function attempt(itemId: string, correct: boolean, at: number, extra: Partial<Attempt> = {}): Attempt {
  const item = itemMap.get(itemId)!;
  return {
    id: uuidv7(at),
    itemId,
    itemVersion: item.version,
    exam: item.exam,
    section: item.section,
    at,
    day: dayKey(at),
    mode: 'drill',
    sessionId: 's1',
    selected: correct ? item.options.find((o) => o.correct)!.id : item.options.find((o) => !o.correct)!.id,
    correct,
    ms: 60000,
    confidence: null,
    eliminated: [],
    changed: false,
    missReason: null,
    xp: 0,
    ...extra,
  };
}

function ctx(exam: 'LSAT' | 'MCAT', attempts: Attempt[] = [], extra: Partial<SelectContext> = {}): SelectContext {
  const pack = packFor(exam);
  return {
    exam,
    items: pack.items,
    passages: pack.passages,
    attempts,
    cards: [],
    ratings: computeRatings(attempts, itemMap),
    now: NOW,
    rng: seededRng(42),
    ...extra,
  };
}

describe('xp', () => {
  const base = { difficulty: 3 as const, answerMs: 60000, explanationMs: 0, wordCount: 100, recentRepeat: false };
  it('scales correct answers by difficulty', () => {
    expect(attemptXp({ ...base, correct: true, difficulty: 1 })).toBe(10);
    expect(attemptXp({ ...base, correct: true, difficulty: 5 })).toBe(25);
  });
  it('pays for reading the explanation after a miss', () => {
    expect(attemptXp({ ...base, correct: false })).toBe(0);
    expect(attemptXp({ ...base, correct: false, explanationMs: 6000 })).toBe(5);
  });
  it('pays nothing for speed-tapping or recent repeats', () => {
    expect(attemptXp({ ...base, correct: true, answerMs: 2000 })).toBe(0);
    expect(attemptXp({ ...base, correct: true, recentRepeat: true })).toBe(0);
  });
  it('maps XP to levels', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(xpForLevel(10)).level).toBe(10);
  });
});

describe('mastery', () => {
  it('rises with correct answers and falls with misses', () => {
    let r = updateRating(undefined, 0, true, NOW, 0.2);
    expect(r.theta).toBeGreaterThan(0);
    r = updateRating(r, 0, false, NOW, 0.2);
    r = updateRating(r, 0, false, NOW, 0.2);
    expect(r.theta).toBeLessThan(0);
  });
  it('fades when a skill is not practiced', () => {
    let r = updateRating(undefined, 0, true, NOW, 0.2);
    for (let i = 0; i < 10; i++) r = updateRating(r, 0, true, NOW, 0.2);
    expect(masteryScore(r, NOW + 60 * DAY_MS)).toBeLessThan(masteryScore(r, NOW));
  });
  it('withholds a tier until there is enough data', () => {
    expect(tierFor(90, 2)).toBe('new');
    expect(tierFor(90, 10)).toBe('elite');
    expect(tierFor(40, 10)).toBe('developing');
  });
  it('rates sections, types and knowledge points', () => {
    const ratings = computeRatings([attempt('lsat-lr-0001', true, NOW)], itemMap);
    expect(ratings.get('LSAT:LR')?.n).toBe(1);
    expect(ratings.get(typeKey('LSAT', 'LR', 'weaken'))?.n).toBe(1);
    expect(ratings.get('kp-lsat-rival-cause')?.n).toBe(1);
  });
});

describe('spaced review', () => {
  it('schedules a missed concept for tomorrow', () => {
    const card = reviewCard(newCard(NOW), 1, NOW, null, false);
    expect(card.due - NOW).toBeGreaterThanOrEqual(0.9 * DAY_MS);
    expect(card.due - NOW).toBeLessThanOrEqual(1.1 * DAY_MS);
  });
  it('never schedules past the exam buffer', () => {
    let card = reviewCard(newCard(NOW), 3, NOW, 10, false);
    for (let i = 0; i < 5; i++) card = reviewCard(card, 4, card.due, 10, false);
    expect(card.scheduled_days).toBeLessThanOrEqual(7);
  });
  it('treats a lucky guess as a lapse', () => {
    expect(ratingForAttempt(true, 'guess')).toBe(1);
    expect(ratingForAttempt(true, 'unsure')).toBe(2);
    expect(ratingForAttempt(true, 'sure')).toBe(3);
    expect(ratingForAttempt(false, 'sure')).toBe(1);
  });
  it('buckets cards Leitner-style', () => {
    expect(bucketFor(newCard(NOW))).toBe('new');
    expect(bucketFor(reviewCard(newCard(NOW), 3, NOW, null, false))).toBe('learning');
  });
});

describe('session building', () => {
  it('builds a Daily 5 of standalone questions', () => {
    for (const exam of ['LSAT', 'MCAT'] as const) {
      const ids = buildDaily5(ctx(exam));
      expect(ids).toHaveLength(DAILY_SIZE);
      expect(new Set(ids).size).toBe(DAILY_SIZE);
      for (const id of ids) {
        expect(itemMap.get(id)?.exam).toBe(exam);
        expect(itemMap.get(id)?.passageId).toBeNull();
      }
    }
  });

  it('prefers questions not seen yet', () => {
    const seen = buildDaily5(ctx('LSAT'));
    const attempts = seen.map((id, i) => attempt(id, true, NOW - DAY_MS + i));
    const next = buildDaily5(ctx('LSAT', attempts));
    expect(next.filter((id) => seen.includes(id))).toHaveLength(0);
  });

  it('includes the weakest question type', () => {
    const attempts = [attempt('lsat-lr-0001', false, NOW - 2 * DAY_MS), attempt('lsat-lr-0002', false, NOW - 2 * DAY_MS)];
    const ids = buildDaily5(ctx('LSAT', attempts));
    const weakenCount = ids.filter((id) => itemMap.get(id)?.type === 'weaken').length;
    expect(weakenCount).toBeGreaterThanOrEqual(1);
  });

  it('filters drills and keeps passage questions together in order', () => {
    const ids = buildDrill(ctx('MCAT'), { sections: ['BB'], types: [], difficulty: 'any', count: 20 });
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(itemMap.get(id)?.section).toBe('BB');
    const passageIds = ids.filter((id) => itemMap.get(id)?.passageId === 'mcat-bb-p01');
    expect(passageIds).toEqual(['mcat-bb-0006', 'mcat-bb-0007', 'mcat-bb-0008']);
  });

  it('turns due knowledge points into review tasks', () => {
    const card = { kpId: 'kp-lsat-rival-cause', exam: 'LSAT' as const, card: { ...newCard(NOW - DAY_MS), due: NOW - 1000 }, source: 'miss' as const, addedAt: NOW, updatedAt: NOW };
    const tasks = buildReviewQueue(ctx('LSAT', [], { cards: [card] }));
    expect(tasks).toHaveLength(1);
    expect(tasks[0].kind).toBe('question');
    expect(itemMap.get(tasks[0].itemId!)?.knowledgePoints).toContain('kp-lsat-rival-cause');
  });

  it('falls back to the concept card when every question was seen recently', () => {
    const recent = ['lsat-lr-0001', 'lsat-lr-0002'].map((id) => attempt(id, false, NOW - 1000));
    const card = { kpId: 'kp-lsat-rival-cause', exam: 'LSAT' as const, card: { ...newCard(NOW), due: NOW - 1000 }, source: 'miss' as const, addedAt: NOW, updatedAt: NOW };
    const tasks = buildReviewQueue(ctx('LSAT', recent, { cards: [card] }));
    expect(tasks[0]).toEqual({ kpId: 'kp-lsat-rival-cause', kind: 'card', itemId: null });
  });

  it('tracks confident mistakes until they are fixed', () => {
    const wrong = attempt('lsat-lr-0001', false, NOW - 2000, { confidence: 'sure' });
    expect(misconceptions([wrong])).toHaveLength(1);
    expect(misconceptions([wrong, attempt('lsat-lr-0001', true, NOW - 1000)])).toHaveLength(0);
  });
});

describe('stats', () => {
  it('summarizes accuracy, misses and calibration', () => {
    const attempts = [
      attempt('lsat-lr-0001', false, NOW - 3000, { confidence: 'sure', missReason: 'misread' }),
      attempt('lsat-lr-0002', false, NOW - 2000, { confidence: 'unsure', changed: true }),
      attempt('lsat-lr-0003', true, NOW - 1000, { confidence: 'sure' }),
    ];
    const s = computeStats(attempts, ['LR', 'RC'], itemMap, computeRatings(attempts, itemMap), NOW);
    expect(s.total).toBe(3);
    expect(s.correct).toBe(1);
    expect(s.sections.find((x) => x.section === 'LR')?.n).toBe(3);
    expect(s.missReasons).toEqual([
      { reason: 'misread', count: 1 },
      { reason: 'changed', count: 1 },
    ]);
    expect(s.calibration.find((c) => c.confidence === 'sure')).toEqual({ confidence: 'sure', n: 2, correct: 1 });
    expect(s.leaks[0]?.type).toBe('weaken');
  });
});

describe('ids', () => {
  it('makes time-ordered UUIDv7s', () => {
    const a = uuidv7(1000);
    const b = uuidv7(2000);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe('content', () => {
  it('ships both exams', () => {
    expect(allItems.some((i) => i.exam === 'LSAT')).toBe(true);
    expect(allItems.some((i) => i.exam === 'MCAT')).toBe(true);
  });
});
