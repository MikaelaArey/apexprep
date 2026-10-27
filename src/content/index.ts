// The starter packs bundled into the app binary, so studying works offline from
// the first launch. Regenerate with `npm run content`.

import lsat from './generated/lsat.json';
import mcat from './generated/mcat.json';
import type { ContentPack, Exam, Item, KnowledgePoint, Passage } from './types';

const PACKS: Record<Exam, ContentPack> = {
  LSAT: lsat as unknown as ContentPack,
  MCAT: mcat as unknown as ContentPack,
};

export function packFor(exam: Exam): ContentPack {
  return PACKS[exam];
}

export const allItems: Item[] = [...PACKS.LSAT.items, ...PACKS.MCAT.items];
export const itemMap: ReadonlyMap<string, Item> = new Map(allItems.map((i) => [i.id, i]));
export const passageMap: ReadonlyMap<string, Passage> = new Map(
  [...PACKS.LSAT.passages, ...PACKS.MCAT.passages].map((p) => [p.id, p]),
);
export const kpMap: ReadonlyMap<string, KnowledgePoint> = new Map(
  [...PACKS.LSAT.knowledgePoints, ...PACKS.MCAT.knowledgePoints].map((k) => [k.id, k]),
);

export function wordCount(item: Item): number {
  const text = [item.stimulus ?? '', item.prompt, ...item.options.map((o) => o.text)].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}
