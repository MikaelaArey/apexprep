// User data model. Attempts, reviews and XP events are append-only facts; every
// number the app shows (streaks, mastery, stats, XP) is derived from them.

import type { Exam, OptionId, SectionId } from '@/content/types';

export type Confidence = 'sure' | 'unsure' | 'guess';
export type MissReason = 'didnt_know' | 'misread' | 'timing' | 'changed' | 'narrowed';
export type SessionKind = 'daily5' | 'drill' | 'passage' | 'review' | 'retry' | 'climb';
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy (FSRS)

export interface Attempt {
  id: string;
  itemId: string;
  itemVersion: number;
  exam: Exam;
  section: SectionId;
  at: number;
  day: string;
  mode: SessionKind;
  sessionId: string;
  selected: OptionId;
  correct: boolean;
  ms: number;
  confidence: Confidence | null;
  eliminated: OptionId[];
  changed: boolean;
  missReason: MissReason | null;
  xp: number;
}

/** FSRS card with dates stored as epoch milliseconds. */
export interface StoredCard {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
}

export interface CardRow {
  kpId: string;
  exam: Exam;
  card: StoredCard;
  source: 'miss' | 'unsure' | 'manual';
  addedAt: number;
  updatedAt: number;
}

export interface Review {
  id: string;
  kpId: string;
  exam: Exam;
  at: number;
  day: string;
  rating: Rating;
  kind: 'card' | 'question';
  itemId: string | null;
  ms: number;
  xp: number;
}

export interface XpEvent {
  id: string;
  at: number;
  day: string;
  kind: 'daily_goal' | 'streak_repair' | 'floor_clear';
  amount: number;
  /** What the event was for, e.g. the Climb floor "MCAT:BB:3". */
  ref?: string;
}

/** A score the student logged from an official exam or a full-length practice test. */
export interface ScoreEntry {
  id: string;
  exam: Exam;
  date: string; // YYYY-MM-DD
  kind: 'official' | 'practice';
  /** Optional name, such as "AAMC Full-Length 2". */
  label: string;
  total: number;
  /** Section scores when known (MCAT: 118–132 each). */
  sections: Partial<Record<SectionId, number>> | null;
  createdAt: number;
}

export interface ExamPlan {
  testDate: string | null; // YYYY-MM-DD
  target: number;
}

export interface Settings {
  onboarded: boolean;
  /** The exam being studied right now; always one of `exams`. */
  exam: Exam;
  /** Exams the student signed up for. Chosen at onboarding; the other can be added in Profile. */
  exams: Exam[];
  plans: Record<Exam, ExamPlan>;
  dailyGoalMin: number;
  reminder: { enabled: boolean; hour: number; minute: number };
  cue: string;
  restDay: number | null; // 0 = Sunday … 6 = Saturday
  confidence: boolean;
  pureStudy: boolean;
  haptics: boolean;
  repairedDays: string[];
  /** Show Sprout, the study buddy who cheers you on during sessions. */
  coach: boolean;
  /** Logged official and practice test scores, oldest first. */
  scores: ScoreEntry[];
  /** Climb floors cleared, keyed by "EXAM:SECTION" (floors are cleared in order). */
  climb: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  exam: 'LSAT',
  exams: ['LSAT'],
  plans: {
    LSAT: { testDate: null, target: 165 },
    MCAT: { testDate: null, target: 510 },
  },
  dailyGoalMin: 10,
  reminder: { enabled: false, hour: 8, minute: 0 },
  cue: 'On my commute',
  restDay: null,
  confidence: true,
  pureStudy: false,
  haptics: true,
  repairedDays: [],
  coach: true,
  scores: [],
  climb: {},
};
