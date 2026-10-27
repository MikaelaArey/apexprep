// Guards the compiled packs: every question must be answerable and explained.
import { packFor } from '@/content';
import { EXAMS, TRAPS, typeName } from '@/content/labels';

describe.each(['LSAT', 'MCAT'] as const)('%s pack', (exam) => {
  const pack = packFor(exam);
  const kpIds = new Set(pack.knowledgePoints.map((k) => k.id));
  const itemIds = new Set(pack.items.map((i) => i.id));

  it.each(pack.items.map((i) => [i.id, i] as const))('%s is well-formed', (_id, item) => {
    expect(item.exam).toBe(exam);
    expect(item.options).toHaveLength(EXAMS[exam].optionCount);
    expect(item.options.filter((o) => o.correct)).toHaveLength(1);
    for (const o of item.options) {
      expect(o.why.length).toBeGreaterThan(10);
      if (!o.correct) expect(TRAPS[o.trap!]).toBeDefined();
    }
    expect(typeName(item.type)).not.toBe(item.type);
    expect(item.steps.length).toBeGreaterThanOrEqual(2);
    for (const kp of item.knowledgePoints) expect(kpIds.has(kp)).toBe(true);
    for (const s of item.siblings) expect(itemIds.has(s)).toBe(true);
  });

  it('links every passage to its questions', () => {
    for (const p of pack.passages) {
      expect(p.itemIds.length).toBeGreaterThanOrEqual(2);
      for (const id of p.itemIds) expect(pack.items.find((i) => i.id === id)?.passageId).toBe(p.id);
    }
  });
});
