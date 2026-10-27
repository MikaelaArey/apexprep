// Spaced review on knowledge points, scheduled with FSRS-6 (ts-fsrs).
//
// Intervals are whole days (no same-day learning steps) and are capped so that
// every review lands at least three days before the test date.

import { createEmptyCard, fsrs, Rating as FsrsRating, State, type Card, type Grade } from 'ts-fsrs';
import type { Confidence, Rating, StoredCard } from '@/data/types';
import { DAY_MS, parseDay } from './time';

export const DESIRED_RETENTION = 0.9;
const EXAM_BUFFER_DAYS = 3;
const MASTERED_STABILITY_DAYS = 21;

export function daysUntil(testDate: string | null, now: number): number | null {
  if (!testDate) return null;
  return Math.ceil((parseDay(testDate).getTime() - now) / DAY_MS);
}

function maxInterval(daysToExam: number | null): number {
  return daysToExam === null ? 36500 : Math.max(1, daysToExam - EXAM_BUFFER_DAYS);
}

export function makeScheduler(daysToExam: number | null, fuzz = true) {
  return fsrs({
    request_retention: DESIRED_RETENTION,
    maximum_interval: maxInterval(daysToExam),
    enable_fuzz: fuzz,
    enable_short_term: false,
  });
}

function toStored(card: Card): StoredCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

function fromStored(s: StoredCard): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    last_review: s.last_review === null ? undefined : new Date(s.last_review),
  };
}

export function newCard(now: number): StoredCard {
  return toStored(createEmptyCard(new Date(now)));
}

// ts-fsrs keeps Hard < Good < Easy by at least a day each, which can push Easy
// past maximum_interval, so the exam cap is enforced here as well.
function capToExam(card: Card, now: number, daysToExam: number | null): Card {
  const cap = maxInterval(daysToExam);
  if (card.scheduled_days <= cap) return card;
  return { ...card, scheduled_days: cap, due: new Date(now + cap * DAY_MS) };
}

export function reviewCard(card: StoredCard, rating: Rating, now: number, daysToExam: number | null, fuzz = true): StoredCard {
  const next = makeScheduler(daysToExam, fuzz).next(fromStored(card), new Date(now), rating as Grade).card;
  return toStored(capToExam(next, now, daysToExam));
}

/** Next due time for each possible rating, for the buttons on a concept card. */
export function previewIntervals(card: StoredCard, now: number, daysToExam: number | null): Record<Rating, number> {
  const preview = makeScheduler(daysToExam, false).repeat(fromStored(card), new Date(now));
  const due = (r: Grade) => capToExam(preview[r].card, now, daysToExam).due.getTime();
  return { 1: due(FsrsRating.Again), 2: due(FsrsRating.Hard), 3: due(FsrsRating.Good), 4: due(FsrsRating.Easy) };
}

export function retrievability(card: StoredCard, now: number): number {
  if (card.state === State.New) return 0;
  return makeScheduler(null, false).get_retrievability(fromStored(card), new Date(now), false);
}

/**
 * A question answered on a knowledge point counts as a review of it. A lucky
 * guess isn't recall, so it counts as a lapse.
 */
export function ratingForAttempt(correct: boolean, confidence: Confidence | null): Rating {
  if (!correct || confidence === 'guess') return 1;
  if (confidence === 'unsure') return 2;
  return 3;
}

export type Bucket = 'new' | 'learning' | 'reviewing' | 'mastered';

export function bucketFor(card: StoredCard): Bucket {
  if (card.state === State.New) return 'new';
  if (card.state === State.Learning || card.state === State.Relearning || card.reps <= 1) return 'learning';
  return card.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'reviewing';
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  new: 'New',
  learning: 'Learning',
  reviewing: 'Reviewing',
  mastered: 'Mastered',
};

export function isDue(card: StoredCard, now: number): boolean {
  return card.due <= now;
}
