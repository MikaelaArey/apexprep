import type { Exam } from '@/content/types';
import type { Rating, SessionKind } from '@/data/types';

export type SessionTask =
  | { kind: 'question'; itemId: string; reviewKp?: string }
  | { kind: 'card'; kpId: string };

export interface TaskResult {
  kind: 'question' | 'card';
  itemId?: string;
  kpId?: string;
  attemptId?: string;
  correct?: boolean;
  rating?: Rating;
  xp: number;
  ms: number;
  cardsAdded: string[];
}

export interface ActiveSession {
  id: string;
  kind: SessionKind;
  exam: Exam;
  title: string;
  tasks: SessionTask[];
  index: number;
  results: TaskResult[];
  startedAt: number;
  /** Set between answering a question and moving on from its explanation. */
  current: { attemptId: string; cardsAdded: string[] } | null;
}

export interface SessionSummary {
  sessionId: string;
  kind: SessionKind;
  exam: Exam;
  title: string;
  questions: number;
  correct: number;
  cardsReviewed: number;
  cardsAdded: number;
  xp: number;
  ms: number;
  dailyGoalReached: boolean;
  streakRepaired: boolean;
  nextReviewAt: number | null;
}
