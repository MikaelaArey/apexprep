// The Climb: a section's questions in order of difficulty, ten to a floor (one
// passage per floor in reading sections). Floors open one at a time; clearing a
// floor takes 70% correct. Every fifth floor is a checkpoint that ends a camp.

import type { Difficulty, Exam, Item, Passage, SectionId } from '@/content/types';

export const FLOOR_SIZE = 10;
export const PASS_RATE = 0.7;
const READING: SectionId[] = ['CARS', 'RC'];

export interface Floor {
  index: number;
  itemIds: string[];
  /** Hardest level on the floor. */
  level: Difficulty;
  /** Ends a camp (every fifth floor, and the summit); clearing it pays extra XP. */
  checkpoint: boolean;
  summit: boolean;
  passageId: string | null;
}

export const climbKey = (exam: Exam, section: SectionId) => `${exam}:${section}`;

const CAMPS = ['Base Camp', 'Pine Ridge', 'Boulder Field', 'High Meadow', 'Glacier', 'Ice Wall', 'Knife Edge', 'Cloud Line', 'Summit Ridge'];

/** Floors 1–5 are Base Camp, 6–10 Pine Ridge, and so on. */
export function campName(floorIndex: number): string {
  return CAMPS[Math.min(CAMPS.length - 1, Math.floor(floorIndex / 5))];
}

export function floorsFor(items: readonly Item[], passages: readonly Passage[], section: SectionId): Floor[] {
  const chunks: { itemIds: string[]; passageId: string | null; level: Difficulty }[] = [];
  if (READING.includes(section)) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const sets = passages
      .filter((p) => p.section === section)
      .map((p) => {
        const its = p.itemIds.map((id) => byId.get(id)).filter((i): i is Item => Boolean(i));
        const mean = its.reduce((n, i) => n + i.rating, 0) / Math.max(1, its.length);
        return { p, its, mean };
      })
      .filter((x) => x.its.length > 0)
      .sort((a, b) => a.mean - b.mean || a.p.id.localeCompare(b.p.id));
    for (const { p, its } of sets) {
      chunks.push({ itemIds: its.map((i) => i.id), passageId: p.id, level: Math.max(...its.map((i) => i.difficulty)) as Difficulty });
    }
  } else {
    const pool = items.filter((i) => i.section === section && i.passageId === null).sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < pool.length; i += FLOOR_SIZE) {
      const slice = pool.slice(i, i + FLOOR_SIZE);
      // Fold a short last floor into the one before it.
      if (slice.length < FLOOR_SIZE / 2 && chunks.length > 0) {
        const prev = chunks[chunks.length - 1];
        prev.itemIds.push(...slice.map((x) => x.id));
        prev.level = Math.max(prev.level, ...slice.map((x) => x.difficulty)) as Difficulty;
      } else {
        chunks.push({ itemIds: slice.map((x) => x.id), passageId: null, level: Math.max(...slice.map((x) => x.difficulty)) as Difficulty });
      }
    }
  }
  return chunks.map((c, index) => ({
    index,
    ...c,
    checkpoint: (index + 1) % 5 === 0 || index === chunks.length - 1,
    summit: index === chunks.length - 1,
  }));
}

export const neededToClear = (floor: Pick<Floor, 'itemIds'>) => Math.ceil(floor.itemIds.length * PASS_RATE);

export interface ClimbProgress {
  cleared: number;
  total: number;
  /** Index of the floor to attempt next (equal to `total` when the summit is done). */
  current: number;
  done: boolean;
}

export function climbProgress(cleared: number | undefined, floors: readonly Floor[]): ClimbProgress {
  const n = Math.min(floors.length, Math.max(0, cleared ?? 0));
  return { cleared: n, total: floors.length, current: n, done: floors.length > 0 && n >= floors.length };
}

/** Bonus XP for clearing a floor for the first time. */
export const floorXp = (floor: Pick<Floor, 'checkpoint'>) => (floor.checkpoint ? 40 : 20);
