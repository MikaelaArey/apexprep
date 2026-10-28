// Sprout, the study buddy: what it says, when it speaks, and how it grows. Lines
// are short and original; picks are seeded so the same moment always gets the
// same line, and different moments rarely repeat.

import type { Exam } from '@/content/types';

export type Mood = 'happy' | 'cheer' | 'think' | 'encourage' | 'sleep';

export type CoachEvent =
  | 'greet'
  | 'correct'
  | 'combo'
  | 'miss'
  | 'boss'
  | 'comeback'
  | 'tip'
  | 'finishGreat'
  | 'finishGood'
  | 'finishTough'
  | 'floorCleared'
  | 'floorMissed'
  | 'badge'
  | 'levelUp'
  | 'personalBest'
  | 'idle';

type Line = string | { text: string; exam: Exam };

const LINES: Record<CoachEvent, Line[]> = {
  greet: [
    'Hi! Ready to grow some neurons?',
    'Let’s make today’s study count.',
    'Small steps, big score. Let’s go!',
    'Your future self says thanks for showing up.',
    'Five focused minutes beat an hour of scrolling.',
    'I stretched my leaves. Ready when you are!',
  ],
  correct: [
    'Nailed it!',
    'That’s the stuff.',
    'Clean answer. Love to see it.',
    'Your brain just leveled up a little.',
    'Correct! Smooth.',
    'Textbook. Literally.',
    'Look at you go!',
    { text: 'That answer was more stable than a benzene ring.', exam: 'MCAT' },
    { text: 'Mitochondria: powerhouse. You: also a powerhouse.', exam: 'MCAT' },
    { text: 'Your synapses are firing in perfect sync.', exam: 'MCAT' },
    { text: 'Krebs would be proud.', exam: 'MCAT' },
    { text: 'Airtight reasoning!', exam: 'LSAT' },
    { text: 'Logic 1, trap answers 0.', exam: 'LSAT' },
  ],
  combo: [
    '{n} in a row! You’re on fire!',
    '{n} straight! Keep it rolling.',
    'Combo ×{n}! Unstoppable.',
    '{n} for {n}. Who are you?!',
    { text: '{n} in a row. Positive feedback loop activated!', exam: 'MCAT' },
  ],
  miss: [
    'Misses now mean fewer misses on test day.',
    'Read the why. That’s where the points hide.',
    'Plot twist: this is how memory gets built.',
    'Shake it off. The next one’s yours.',
    'Wrong answers are just data. Good data!',
    'Tough one. It’s in your review pile now.',
    'Your brain grows most right after a miss.',
    'Even experts missed this kind once. Now you won’t.',
  ],
  boss: ['You beat a Boss question! Huge.', 'Boss defeated! That was one of the hardest.', 'Only the toughest questions wear the crown. You took it!'],
  comeback: ['Redemption! You missed this one before.', 'Look who learned from last time!', 'Revenge of the reviewer. Nicely done!'],
  tip: [
    'Tip: spacing beats cramming. A little every day wins.',
    'Tip: say the reason out loud. It sticks better.',
    'Tip: long-press an answer to cross it out.',
    'Tip: sleep is when memories get filed. Rest counts!',
    'Tip: if two answers look alike, find the word that differs.',
    'Tip: predict the answer before you read the choices.',
    { text: 'Tip: in CARS, the author’s view beats everyone else’s.', exam: 'MCAT' },
    { text: 'Tip: check the units first. They often solve the problem.', exam: 'MCAT' },
    { text: 'Tip: in experiments, find the independent variable first.', exam: 'MCAT' },
    { text: 'Tip: estimate before you calculate. It catches slips.', exam: 'MCAT' },
    { text: 'Tip: find the conclusion before the answer choices.', exam: 'LSAT' },
    { text: 'Tip: negate an answer to test a necessary assumption.', exam: 'LSAT' },
  ],
  finishGreat: ['Incredible! {correct} of {total}!', 'That was a masterclass. Take a bow.', 'You crushed it. I’m doing a happy dance!'],
  finishGood: ['Solid work! Every session builds the base.', 'Nice! {correct} of {total} and climbing.', 'Good session. Review the misses and they’re yours.'],
  finishTough: ['Tough set, but you showed up. That’s what counts.', 'Hard questions grow strong brains.', 'Today we found the weak spots. Next time we fix them.'],
  floorCleared: ['Floor cleared! The view’s getting better up here.', 'Up we go! Next floor unlocked.', 'Onward and upward. Next floor’s open!'],
  floorMissed: ['So close! You need {needed} to clear it. Try again?', 'Almost there. Review the misses and climb again.'],
  badge: ['New badge: {badge}! Shiny!', 'You earned {badge}. Wear it proudly!'],
  levelUp: ['Level {level}! I think I just grew a little.', 'Level up! Look at us grow.'],
  personalBest: ['New personal best: {score}! Real progress.', 'Up {change} points! Your work is showing.'],
  idle: ['Zzz… Oh! Ready when you are.'],
};

const MOODS: Record<CoachEvent, Mood> = {
  greet: 'happy',
  correct: 'happy',
  combo: 'cheer',
  miss: 'encourage',
  boss: 'cheer',
  comeback: 'cheer',
  tip: 'think',
  finishGreat: 'cheer',
  finishGood: 'happy',
  finishTough: 'encourage',
  floorCleared: 'cheer',
  floorMissed: 'encourage',
  badge: 'cheer',
  levelUp: 'cheer',
  personalBest: 'cheer',
  idle: 'sleep',
};

export interface CoachLine {
  text: string;
  mood: Mood;
  event: CoachEvent;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export function coachLine(event: CoachEvent, seed: string, exam: Exam, vars: Record<string, string | number> = {}): CoachLine {
  const pool = LINES[event].filter((l) => typeof l === 'string' || l.exam === exam);
  const line = pool[hash(`${event}:${seed}`) % pool.length];
  const text = (typeof line === 'string' ? line : line.text).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
  return { text, mood: MOODS[event], event };
}

export interface AnswerMoment {
  correct: boolean;
  /** Consecutive correct answers in this session, including this one. */
  combo: number;
  /** Position in the session (0-based). */
  index: number;
  boss: boolean;
  /** This item was missed in an earlier attempt. */
  comeback: boolean;
  /** The previous answer in this session was also wrong. */
  missedLast: boolean;
}

/** Decides whether Sprout speaks after an answer, and about what. */
export function reactTo(m: AnswerMoment): CoachEvent | null {
  if (m.correct && m.boss) return 'boss';
  if (m.correct && m.comeback) return 'comeback';
  if (m.correct && (m.combo === 3 || m.combo === 5 || (m.combo >= 10 && m.combo % 5 === 0))) return 'combo';
  if (!m.correct && m.missedLast) return 'miss';
  if ((m.index + 1) % 3 === 0) return m.correct ? (m.index % 2 === 0 ? 'correct' : 'tip') : 'miss';
  return null;
}

export const finishEvent = (correct: number, total: number): CoachEvent =>
  total === 0 ? 'finishGood' : correct / total >= 0.8 ? 'finishGreat' : correct / total >= 0.5 ? 'finishGood' : 'finishTough';

/** Sprout grows as you level up. */
export const STAGES = [
  { level: 1, name: 'Seedling' },
  { level: 5, name: 'Sapling' },
  { level: 10, name: 'Bloom' },
  { level: 20, name: 'Scholar' },
  { level: 30, name: 'Sage' },
] as const;

export function stageFor(level: number): number {
  let stage = 0;
  STAGES.forEach((s, i) => {
    if (level >= s.level) stage = i;
  });
  return stage;
}

export function nextStage(level: number): (typeof STAGES)[number] | null {
  return STAGES.find((s) => s.level > level) ?? null;
}
