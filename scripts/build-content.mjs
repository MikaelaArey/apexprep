#!/usr/bin/env node
// Compiles the YAML question bank in /content into the JSON packs the app ships
// with (src/content/generated/<exam>.json), validating every item on the way.
//
//   npm run content          build and validate
//   npm run content -- --check   validate only, don't write
//
// Fails (exit 1) on any error, so a broken item can never reach the app.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { z } from 'zod';
import { NUMERIC, numericValue } from './item-models/helpers.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const taxonomy = JSON.parse(readFileSync(join(root, 'src/content/taxonomy.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

const EXAM_DIRS = { LSAT: 'lsat', MCAT: 'mcat' };
// A file's section comes from its name before the first dash: lr.yaml, lr-flaw.yaml → LR.
const FILE_SECTION = { lr: 'LR', rc: 'RC', cp: 'CP', cars: 'CARS', bb: 'BB', ps: 'PS' };
const OPTION_IDS = ['A', 'B', 'C', 'D', 'E'];

// Answer order is shuffled at build time so correct answers spread evenly across
// A–E. The shuffle is seeded by the question id, so an item's order never changes
// between builds (attempts store the chosen letter). Explanations therefore must
// never refer to answer letters. All-numeric answer sets are sorted instead.
function seedFrom(text) {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function orderOptions(id, options, fixed) {
  if (fixed) return options;
  if (options.every((o) => NUMERIC.test(o.text))) {
    return [...options].sort((a, b) => numericValue(a.text) - numericValue(b.text));
  }
  const next = rng(seedFrom(id));
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Phrases that point at an answer by letter, which shuffling would break.
const LETTER_REF = /\b([Oo]nly|[Nn]egate|[Cc]hoices?|[Aa]nswer|[Oo]ptions?)\s+\(?[A-E]\)?(?=[\s.,;:)]|$)|\b[A-E]\s*→|→\s*[A-E]\b|\(not [A-E]\)/;

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const text = z.string().trim().min(1);
const step = z.strictObject({ label: text, body: text });
const table = z.strictObject({
  caption: text.optional(),
  columns: z.array(text).min(2),
  rows: z.array(z.array(z.string())).min(1),
});
const option = z.strictObject({
  text: z.union([text, z.number()]).transform(String),
  correct: z.boolean().optional(),
  trap: z.string().nullable().optional(),
  why: text,
});
const itemSchema = z.strictObject({
  id: z.string().regex(/^(lsat|mcat)-[a-z]+-\d{4}$/),
  version: z.number().int().min(1).optional(),
  type: text,
  family: text.optional(),
  kps: z.array(text).min(1),
  outline: z
    .strictObject({ category: z.string().regex(/^\d{1,2}[A-E]$/).optional(), sirs: z.number().int().min(1).max(4).optional() })
    .optional(),
  difficulty: z.number().int().min(1).max(5),
  targetSec: z.number().int().min(20).max(600).optional(),
  model: text.optional(),
  fixedOrder: z.boolean().optional(),
  stimulus: text.optional(),
  prompt: text,
  table: table.optional(),
  options: z.array(option).min(4).max(5),
  tldr: text,
  steps: z.array(step).min(2).max(6),
  takeaway: text,
  siblings: z.array(text).default([]),
  status: z.enum(['draft', 'review', 'live']).optional(),
});
const passageSchema = z.strictObject({
  id: z.string().regex(/^(lsat|mcat)-[a-z]+-p\d{2}$/),
  title: text,
  domain: text,
  mini: z.boolean().optional(),
  paragraphs: z.array(text).min(1),
  table: table.optional(),
});
const kpSchema = z.strictObject({
  id: z.string().regex(/^kp-[a-z0-9-]+$/),
  section: z.enum(Object.keys(taxonomy.sections)),
  title: text,
  front: text,
  back: text,
});

function parse(schema, value, where) {
  const result = schema.safeParse(value);
  if (!result.success) {
    fail(where, z.prettifyError(result.error).replace(/\n/g, '\n    '));
    return null;
  }
  return result.data;
}

function readYaml(file) {
  try {
    return load(readFileSync(file, 'utf8')) ?? [];
  } catch (e) {
    fail(file.replace(root + '/', ''), `YAML parse error: ${e.message}`);
    return [];
  }
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;

function buildItem(raw, exam, section, where, passageId, position) {
  const data = parse(itemSchema, raw, where);
  if (!data) return null;
  const examInfo = taxonomy.exams[exam];
  const typeInfo = taxonomy.types[data.type];
  if (!typeInfo) fail(where, `unknown type "${data.type}" (add it to taxonomy.json)`);
  else if (typeInfo.section !== section) fail(where, `type "${data.type}" belongs to ${typeInfo.section}, not ${section}`);
  data.family ??= typeInfo?.family;
  if (!taxonomy.families[data.family]) fail(where, `unknown family "${data.family}"`);
  if (!data.id.startsWith(`${exam.toLowerCase()}-`)) fail(where, `id should start with ${exam.toLowerCase()}-`);
  if (data.options.length !== examInfo.optionCount) {
    fail(where, `${exam} questions need ${examInfo.optionCount} options, found ${data.options.length}`);
  }
  const correct = data.options.filter((o) => o.correct);
  if (correct.length !== 1) fail(where, `needs exactly one correct option, found ${correct.length}`);
  data.options.forEach((o, i) => {
    const at = `${where} option ${OPTION_IDS[i]}`;
    if (o.correct && o.trap) fail(at, 'the correct option should not have a trap');
    if (!o.correct) {
      if (!o.trap) fail(at, 'wrong options need a trap tag');
      else if (!taxonomy.traps[o.trap]) fail(at, `unknown trap "${o.trap}"`);
    }
  });
  const texts = data.options.map((o) => o.text.toLowerCase());
  if (new Set(texts).size !== texts.length) fail(where, 'two options have the same text');
  if (section === 'LR' && !data.stimulus) fail(where, 'Logical Reasoning items need a stimulus');
  if (passageId && data.stimulus) warn(where, 'passage items usually have no stimulus of their own');
  if (words(data.tldr) > 30) warn(where, `tldr is ${words(data.tldr)} words (style guide: 25 or fewer)`);
  for (const s of data.steps) if (words(s.body) > 45) warn(where, `step "${s.label}" is ${words(s.body)} words (style guide: 40 or fewer)`);
  for (const [i, o] of data.options.entries()) {
    if (words(o.why) > 40) warn(`${where} option ${OPTION_IDS[i]}`, `rationale is ${words(o.why)} words (style guide: 30 or fewer)`);
  }
  const explanationText = [data.tldr, data.takeaway, ...data.steps.map((st) => st.body), ...data.options.map((o) => o.why)];
  for (const t of explanationText) {
    if (LETTER_REF.test(t)) fail(where, `explanation refers to an answer letter (answers are shuffled): "${t.slice(0, 80)}"`);
  }
  const ordered = orderOptions(data.id, data.options, data.fixedOrder);

  return {
    id: data.id,
    version: data.version ?? 1,
    exam,
    section,
    passageId,
    position,
    type: data.type,
    family: data.family,
    knowledgePoints: data.kps,
    ...(data.outline ? { outline: data.outline } : {}),
    difficulty: data.difficulty,
    rating: 0,
    rank: 0,
    targetSec: data.targetSec ?? taxonomy.sections[section].targetSec,
    ...(data.stimulus ? { stimulus: data.stimulus } : {}),
    prompt: data.prompt,
    ...(data.table ? { table: data.table } : {}),
    ...(data.model ? { model: data.model } : {}),
    options: ordered.map((o, i) => ({
      id: OPTION_IDS[i],
      text: o.text,
      correct: Boolean(o.correct),
      trap: o.correct ? null : (o.trap ?? null),
      why: o.why,
    })),
    tldr: data.tldr,
    steps: data.steps,
    takeaway: data.takeaway,
    siblings: data.siblings,
    status: data.status ?? 'review',
  };
}

// ---------- Difficulty ranking ----------
// Authors rate each question 1–5, but generated families all start at the same
// rating, so the build calibrates. A rubric scores each question's demands (its
// format, the number of solution steps, passage reading, reading load and how
// subtle its wrong answers are), questions are ranked within their section, and
// the five levels are cut at fixed percentiles: the hardest tenth of each section
// is "Boss". Rankings are relative to the bank, not a prediction of exam scores.
const LEVEL_CUTS = [0.2, 0.45, 0.7, 0.9]; // Warm-up | Easy | Medium | Hard | Boss
const SUBTLE_TRAPS = new Set([
  'distortion', 'half_right', 'too_narrow', 'wrong_viewpoint', 'skipped_step', 'sign_flip',
  'power_of_ten', 'misread_data', 'irrelevant_comparison', 'doesnt_differentiate',
]);
const PASSAGE_BASE = {
  cars_main_idea: 2.7, cars_tone: 2.7, cars_function: 3.0, cars_inference: 3.2, cars_application: 3.4, cars_challenge: 3.7,
  rc_detail: 2.2, rc_main_point: 2.6, rc_attitude: 2.7, rc_function: 3.0, rc_inference: 3.2, rc_application: 3.4, rc_comparative: 3.3,
};
const wordsIn = (s) => (s ? s.split(/\s+/).filter(Boolean).length : 0);

function difficultyRating(item) {
  const authored = item.difficulty;
  const stemWords = wordsIn(item.stimulus) + wordsIn(item.prompt);
  const optionWords = item.options.reduce((n, o) => n + wordsIn(o.text), 0) / item.options.length;
  const subtle = item.options.filter((o) => SUBTLE_TRAPS.has(o.trap)).length;
  const concept = item.model?.startsWith('concept-');
  const calc = item.exam === 'MCAT' && item.model && !concept;
  let r;
  if (item.section === 'CARS' || item.section === 'RC') {
    // Reading sets: the skill tested matters most, then how long the choices are.
    r = (PASSAGE_BASE[item.type] ?? 3.0) + (authored - 2) * 0.35 + Math.min(0.4, Math.max(0, optionWords - 12) * 0.03) + subtle * 0.05;
  } else if (concept) {
    // Concept drills: one-line recall is easiest; scenarios and research design are
    // harder. Length counts a little, but the material's difficulty counts most.
    r = 1.3 + Math.min(0.5, stemWords * 0.006) + ((item.outline?.sirs ?? 1) - 1) * 0.3 + (authored - 2) * 0.45 + subtle * 0.05;
  } else if (calc) {
    // Calculations: each extra step, logs or exponents, and every number to juggle.
    const work = `${item.prompt} ${item.steps.map((st) => st.body).join(' ')}`;
    const numbers = (item.prompt.match(/\d+(\.\d+)?/g) ?? []).length;
    const heavy = /\blog\b|\bln\b|√|\^|×\s?10|10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(work);
    r = 1.5 + 0.35 * (item.steps.length - 1) + (heavy ? 0.3 : 0) + 0.05 * Math.min(8, numbers) + (authored - 2) * 0.45;
  } else {
    // Hand-written discretes and arguments: the author's rating, plus reading load.
    r = 1.4 + (authored - 1) * 0.6 + Math.min(0.6, stemWords / 150) + subtle * 0.08;
  }
  if (item.passageId && item.section !== 'CARS' && item.section !== 'RC') r += 0.6; // science passages
  return Math.round(Math.max(1, Math.min(5, r)) * 100) / 100;
}

/** Sets each item's rating, its rank within its section (1 = easiest) and its level (1–5). */
function rankDifficulty(items) {
  for (const item of items) item.rating = difficultyRating(item);
  const sections = [...new Set(items.map((i) => i.section))];
  for (const section of sections) {
    const group = items
      .filter((i) => i.section === section)
      .sort((a, b) => a.rating - b.rating || a.difficulty - b.difficulty || wordsIn(a.prompt) - wordsIn(b.prompt) || a.id.localeCompare(b.id));
    group.forEach((item, i) => {
      const percentile = (i + 1) / group.length;
      item.rank = i + 1;
      item.difficulty = 1 + LEVEL_CUTS.filter((cut) => percentile > cut).length;
    });
  }
}

function buildExam(exam) {
  const dir = join(root, 'content', EXAM_DIRS[exam]);
  const kpFiles = readdirSync(dir).filter((f) => f.startsWith('knowledge-points') && f.endsWith('.yaml')).sort();
  const kpsRaw = kpFiles.flatMap((f) => readYaml(join(dir, f)));
  const knowledgePoints = [];
  for (const [i, raw] of kpsRaw.entries()) {
    const kp = parse(kpSchema, raw, `${EXAM_DIRS[exam]}/knowledge-points.yaml #${i + 1}`);
    if (kp) {
      if (taxonomy.sections[kp.section].exam !== exam) fail(kp.id, `section ${kp.section} isn't an ${exam} section`);
      knowledgePoints.push({ ...kp, exam });
    }
  }

  const items = [];
  const passages = [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') && !f.startsWith('knowledge-points')).sort();
  for (const file of files) {
    const section = FILE_SECTION[file.replace('.yaml', '').split('-')[0]];
    if (!section) {
      fail(`${EXAM_DIRS[exam]}/${file}`, `file name must start with one of ${Object.keys(FILE_SECTION).join(', ')}`);
      continue;
    }
    for (const [i, entry] of readYaml(join(dir, file)).entries()) {
      const where = `${EXAM_DIRS[exam]}/${file} #${i + 1}${entry?.id ? ` (${entry.id})` : ''}`;
      if (entry && typeof entry === 'object' && 'passage' in entry) {
        const p = parse(passageSchema, entry.passage, `${where} passage`);
        if (!p) continue;
        const setItems = (entry.items ?? []).map((raw, j) =>
          buildItem(raw, exam, section, `${EXAM_DIRS[exam]}/${file} ${p.id} q${j + 1}${raw?.id ? ` (${raw.id})` : ''}`, p.id, j + 1),
        );
        if (setItems.length < 2) fail(`${where} passage`, 'a passage needs at least two questions');
        const passageWords = words(p.paragraphs.join(' '));
        if (p.mini && passageWords > 260) warn(p.id, `mini-passage is ${passageWords} words (target 150–250)`);
        passages.push({
          id: p.id,
          exam,
          section,
          title: p.title,
          domain: p.domain,
          paragraphs: p.paragraphs,
          ...(p.table ? { table: p.table } : {}),
          mini: Boolean(p.mini),
          itemIds: setItems.filter(Boolean).map((it) => it.id),
        });
        items.push(...setItems.filter(Boolean));
      } else {
        const item = buildItem(entry, exam, section, where, null, null);
        if (item) items.push(item);
      }
    }
  }

  // Cross-references: unique ids, knowledge points, siblings.
  const ids = new Set();
  for (const id of [...items.map((i) => i.id), ...passages.map((p) => p.id), ...knowledgePoints.map((k) => k.id)]) {
    if (ids.has(id)) fail(id, 'duplicate id');
    ids.add(id);
  }
  const kpIds = new Set(knowledgePoints.map((k) => k.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const item of items) {
    for (const kp of item.knowledgePoints) if (!kpIds.has(kp)) fail(item.id, `unknown knowledge point "${kp}"`);
    for (const sib of item.siblings) {
      const other = byId.get(sib);
      if (!other) fail(item.id, `unknown sibling "${sib}"`);
      else if (!other.knowledgePoints.some((k) => item.knowledgePoints.includes(k))) {
        fail(item.id, `sibling ${sib} shares no knowledge point with it`);
      }
    }
  }
  // Siblings are symmetric: if A lists B, B also lists A.
  for (const item of items) {
    for (const sib of item.siblings) {
      const other = byId.get(sib);
      if (other && !other.siblings.includes(item.id)) other.siblings.push(item.id);
    }
  }
  // Near-duplicate questions (same stem and prompt, nearly the same words).
  const tokens = (i) => new Set(`${i.stimulus ?? ''} ${i.prompt} ${i.options.map((o) => o.text).join(' ')}`.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const sets = items.filter((i) => !i.model).map((i) => [i.id, tokens(i)]);
  for (let a = 0; a < sets.length; a++) {
    for (let b = a + 1; b < sets.length; b++) {
      const [ida, ta] = sets[a];
      const [idb, tb] = sets[b];
      let inter = 0;
      for (const t of ta) if (tb.has(t)) inter++;
      const jaccard = inter / (ta.size + tb.size - inter);
      if (jaccard > 0.8) warn(ida, `looks like a near-duplicate of ${idb} (${Math.round(jaccard * 100)}% shared words)`);
    }
  }

  const usedKps = new Set(items.flatMap((i) => i.knowledgePoints));
  for (const kp of knowledgePoints) if (!usedKps.has(kp.id)) warn(kp.id, 'knowledge point is not used by any question');

  rankDifficulty(items);
  const body = { items, passages, knowledgePoints };
  const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  return { exam, version, generatedAt: new Date().toISOString(), ...body };
}

const packs = Object.keys(EXAM_DIRS).map(buildExam);

for (const w of warnings) console.warn(`warning  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error    ${e}`);
  console.error(`\n${errors.length} error(s). Nothing was written.`);
  process.exit(1);
}

const outDir = join(root, 'src/content/generated');
if (!checkOnly) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const pack of packs) {
    writeFileSync(join(outDir, `${pack.exam.toLowerCase()}.json`), JSON.stringify(pack, null, 1) + '\n');
  }
}

for (const pack of packs) {
  const bySection = {};
  for (const item of pack.items) bySection[item.section] = (bySection[item.section] ?? 0) + 1;
  const summary = Object.entries(bySection)
    .map(([s, n]) => `${s} ${n}`)
    .join(', ');
  const positions = {};
  for (const item of pack.items) {
    const pos = item.options.find((o) => o.correct).id;
    positions[pos] = (positions[pos] ?? 0) + 1;
  }
  const spread = Object.keys(positions)
    .sort()
    .map((k) => `${k} ${Math.round((100 * positions[k]) / pack.items.length)}%`)
    .join(' ');
  const levels = [1, 2, 3, 4, 5].map((l) => pack.items.filter((i) => i.difficulty === l).length).join('/');
  const generated = pack.items.filter((i) => i.model).length;
  console.log(
    `${pack.exam}: ${pack.items.length} questions (${summary}${generated ? `; ${generated} from item models` : ''}), ` +
      `${pack.passages.length} passages, ${pack.knowledgePoints.length} concept cards · levels ${levels} · answers ${spread} · v${pack.version}`,
  );
}
console.log(checkOnly ? 'Content is valid.' : `Wrote ${packs.length} packs to src/content/generated/.`);
