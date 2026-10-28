// Development only: fills the app with three weeks of realistic history so
// every screen can be checked with data in it. Not reachable in release builds.

import { packFor, wordCount } from '@/content';
import type { Exam } from '@/content/types';
import type { Attempt, CardRow, Confidence, MissReason, Review } from '@/data/types';
import { uuidv7 } from '@/engine/ids';
import { seededRng } from '@/engine/random';
import { newCard, ratingForAttempt, reviewCard } from '@/engine/srs';
import { DAY_MS, dayKey } from '@/engine/time';
import { attemptXp } from '@/engine/xp';
import { getRepo, useStore } from '@/state/store';

const REASONS: MissReason[] = ['didnt_know', 'misread', 'misread', 'timing', 'narrowed'];

export async function loadDemoHistory(exam: Exam, days = 21): Promise<void> {
  const repo = getRepo();
  if (!repo) return;
  const rng = seededRng(7);
  const pack = packFor(exam);
  const items = pack.items;
  const cards = new Map<string, CardRow>();
  const attempts: Attempt[] = [];
  const reviews: Review[] = [];
  const skip = new Set([days - 4, days - 11]); // two missed days

  for (let d = days; d >= 1; d--) {
    if (skip.has(d)) continue;
    const base = new Date();
    base.setHours(8, 10, 0, 0);
    let at = base.getTime() - d * DAY_MS;
    const count = 5 + Math.floor(rng() * 7);
    const skill = 0.55 + (0.2 * (days - d)) / days;
    for (let q = 0; q < count; q++) {
      const item = items[Math.floor(rng() * items.length)];
      const easier = (3 - item.difficulty) * 0.06;
      const correct = rng() < skill + easier;
      const confidence: Confidence = correct ? (rng() < 0.7 ? 'sure' : 'unsure') : rng() < 0.35 ? 'sure' : rng() < 0.6 ? 'unsure' : 'guess';
      const ms = Math.round(item.targetSec * 1000 * (0.7 + rng() * 0.7));
      at += ms + 20_000;
      const wrong = item.options.filter((o) => !o.correct);
      const selected = correct ? item.options.find((o) => o.correct)!.id : wrong[Math.floor(rng() * wrong.length)].id;
      const attempt: Attempt = {
        id: uuidv7(at),
        itemId: item.id,
        itemVersion: item.version,
        exam,
        section: item.section,
        at,
        day: dayKey(at),
        mode: q < 5 ? 'daily5' : 'drill',
        sessionId: `demo-${d}`,
        selected,
        correct,
        ms,
        confidence,
        eliminated: [],
        changed: !correct && rng() < 0.15,
        missReason: !correct && rng() < 0.6 ? REASONS[Math.floor(rng() * REASONS.length)] : null,
        xp: correct ? attemptXp({ correct, difficulty: item.difficulty, answerMs: ms, explanationMs: 0, wordCount: wordCount(item), recentRepeat: false }) : 5,
      };
      attempts.push(attempt);
      const rating = ratingForAttempt(correct, confidence);
      for (const kpId of item.knowledgePoints) {
        const existing = cards.get(kpId);
        if (!existing && rating >= 3) continue;
        if (existing && rating >= 3 && existing.card.due > at) continue;
        cards.set(kpId, {
          kpId,
          exam,
          card: reviewCard(existing?.card ?? newCard(at), rating, at, null),
          source: existing?.source ?? (correct ? 'unsure' : 'miss'),
          addedAt: existing?.addedAt ?? at,
          updatedAt: at,
        });
        reviews.push({ id: uuidv7(at), kpId, exam, at, day: attempt.day, rating, kind: 'question', itemId: item.id, ms, xp: 0 });
      }
    }
  }

  for (const a of attempts) await repo.addAttempt(a);
  for (const r of reviews) await repo.addReview(r);
  for (const card of cards.values()) await repo.putCard(card);
  await useStore.getState().reload();

  // A test date and a few practice-test scores trending toward the goal.
  const now = new Date().getTime();
  const store = useStore.getState();
  const { plans } = store.settings;
  store.updateSettings({ plans: { ...plans, [exam]: { ...plans[exam], testDate: dayKey(now + 52 * DAY_MS) } } });
  const scores =
    exam === 'MCAT'
      ? [
          { ago: 20, total: 497, sections: { CP: 124, CARS: 123, BB: 125, PS: 125 } },
          { ago: 12, total: 501, sections: { CP: 125, CARS: 124, BB: 126, PS: 126 } },
          { ago: 4, total: 505, sections: { CP: 126, CARS: 125, BB: 127, PS: 127 } },
        ]
      : [
          { ago: 20, total: 158, sections: null },
          { ago: 12, total: 161, sections: null },
          { ago: 4, total: 164, sections: null },
        ];
  scores.forEach((s, i) =>
    store.saveScore({
      id: `demo-score-${exam}-${i}`,
      exam,
      date: dayKey(now - s.ago * DAY_MS),
      kind: 'practice',
      label: `Practice test ${i + 1}`,
      total: s.total,
      sections: s.sections,
      createdAt: now - s.ago * DAY_MS,
    }),
  );
}
