// Concept-set questions: a short scenario or question whose answer is one term
// from a set of related terms. The wrong options are look-alike terms from the
// same set, and every option's explanation is that term's definition, so picking
// a wrong answer always shows what the chosen term really means.
//
// A set looks like:
//   { id, type, category, sirs, difficulty, ask, kp: [id, title, front, back] or an existing kp id,
//     terms: { Term: [definition, tip?, [confusers]?] },
//     items: [[stem, answer, clue, { not?, options?, difficulty? }?]] }
//
// `not` drops terms that would also be defensible answers; `options` fixes the
// three wrong answers. Ids are stable: set n's items are numbered from
// 6000 + 25n, in order, so add sets at the end of a file and items at the end of
// a set (25 per set at most).

import { seeded, shuffle, steps } from './helpers.mjs';

export function conceptModule(section, sets) {
  return {
    knowledgePoints: sets.filter((s) => Array.isArray(s.kp)).map((s) => s.kp),
    build(make) {
      sets.forEach((set, n) => {
        if (set.items.length > 25) throw new Error(`${set.id}: more than 25 items`);
        const names = Object.keys(set.terms);
        set.items.forEach(([stem, answer, clue, extra = {}], i) => {
          const where = `${set.id} item ${i + 1}`;
          const term = set.terms[answer];
          if (!term) throw new Error(`${where}: unknown answer "${answer}"`);
          const r = seeded(`${set.id}-${i}`);
          const excluded = new Set([answer, ...(extra.not ?? [])]);
          const pool = extra.options ?? [...shuffle(term[2] ?? [], r), ...shuffle(names, r)];
          const wrong = [...new Set(pool)].filter((name) => !excluded.has(name)).slice(0, 3);
          for (const name of wrong) if (!set.terms[name]) throw new Error(`${where}: unknown option "${name}"`);
          if (wrong.length < 3) throw new Error(`${where}: not enough wrong answers`);
          const [definition, tip] = term;
          const ends = /[?:]$/.test(stem);
          if (!ends && !set.ask) throw new Error(`${where}: stem needs a question, or the set needs an ask`);
          make({
            id: `mcat-${section}-${6000 + 25 * n + i}`,
            model: `concept-${set.id}`,
            type: set.type,
            kps: [Array.isArray(set.kp) ? set.kp[0] : set.kp],
            outline: { ...(set.category ? { category: set.category } : {}), sirs: set.sirs ?? 1 },
            difficulty: extra.difficulty ?? set.difficulty ?? 2,
            prompt: ends ? stem : `${stem} ${set.ask}`,
            options: [
              { text: answer, correct: true, why: clue },
              ...wrong.map((name) => ({ text: name, trap: 'lookalike', why: `${name}: ${set.terms[name][0]}.` })),
            ],
            tldr: `${answer}: ${definition}.`,
            steps: steps(['Spot the clue', clue], ['Name it', `${answer}: ${definition}.`]),
            takeaway: tip ?? set.tip,
          });
        });
      });
    },
  };
}
