// Difficulty levels. Each question's level is its difficulty percentile within its
// section (set at build time by scripts/build-content.mjs), so every section has
// warm-ups and bosses.

import type { Difficulty, Item } from '@/content/types';

export const LEVELS: Record<Difficulty, { name: string; blurb: string }> = {
  1: { name: 'Warm-up', blurb: 'The easiest fifth of the section' },
  2: { name: 'Easy', blurb: 'Easier than most' },
  3: { name: 'Medium', blurb: 'The middle of the pack' },
  4: { name: 'Hard', blurb: 'Harder than most' },
  5: { name: 'Boss', blurb: 'The hardest tenth of the section' },
};

export const levelName = (d: Difficulty) => LEVELS[d].name;

export type DifficultyBand = 'any' | 'easy' | 'medium' | 'hard' | 'boss';

export const BANDS: { id: DifficultyBand; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'easy', label: 'Warm-up & Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
  { id: 'boss', label: 'Boss' },
];

export function inBand(d: number, band: DifficultyBand): boolean {
  if (band === 'any') return true;
  if (band === 'easy') return d <= 2;
  if (band === 'medium') return d === 3;
  if (band === 'hard') return d === 4;
  return d === 5;
}

/** "Hardest 8%" style label from an item's rank within its section. */
export function rankLabel(item: Item, sectionSize: number): string {
  const share = item.rank / Math.max(1, sectionSize);
  if (share > 0.5) return `Harder than ${Math.floor(share * 100)}% of the section`;
  return `Easier than ${Math.floor((1 - share) * 100)}% of the section`;
}
