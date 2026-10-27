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
  /** For Climb sessions: which floor is being attempted. */
  climb?: { key: string; floor: number; checkpoint: boolean };
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
  /** For Climb sessions: the floor attempted and whether it was cleared. */
  climb?: { key: string; floor: number; checkpoint: boolean; cleared: boolean; needed: number; firstClear: boolean };
}
