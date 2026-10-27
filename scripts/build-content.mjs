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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const taxonomy = JSON.parse(readFileSync(join(root, 'src/content/taxonomy.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

const EXAM_DIRS = { LSAT: 'lsat', MCAT: 'mcat' };
const FILE_SECTION = { lr: 'LR', rc: 'RC', cp: 'CP', cars: 'CARS', bb: 'BB', ps: 'PS' };
const OPTION_IDS = ['A', 'B', 'C', 'D', 'E'];

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
  family: text,
  kps: z.array(text).min(1),
  outline: z
    .strictObject({ category: z.string().regex(/^\d{1,2}[A-E]$/).optional(), sirs: z.number().int().min(1).max(4).optional() })
    .optional(),
  difficulty: z.number().int().min(1).max(5),
  targetSec: z.number().int().min(20).max(600).optional(),
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
    targetSec: data.targetSec ?? taxonomy.sections[section].targetSec,
    ...(data.stimulus ? { stimulus: data.stimulus } : {}),
    prompt: data.prompt,
    ...(data.table ? { table: data.table } : {}),
    options: data.options.map((o, i) => ({
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

function buildExam(exam) {
  const dir = join(root, 'content', EXAM_DIRS[exam]);
  const kpsRaw = readYaml(join(dir, 'knowledge-points.yaml'));
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
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') && f !== 'knowledge-points.yaml').sort();
  for (const file of files) {
    const section = FILE_SECTION[file.replace('.yaml', '')];
    if (!section) {
      fail(`${EXAM_DIRS[exam]}/${file}`, `file name must be one of ${Object.keys(FILE_SECTION).join(', ')}`);
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
  const usedKps = new Set(items.flatMap((i) => i.knowledgePoints));
  for (const kp of knowledgePoints) if (!usedKps.has(kp.id)) warn(kp.id, 'knowledge point is not used by any question');

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
  console.log(
    `${pack.exam}: ${pack.items.length} questions (${summary}), ${pack.passages.length} passages, ` +
      `${pack.knowledgePoints.length} concept cards · v${pack.version}`,
  );
}
console.log(checkOnly ? 'Content is valid.' : `Wrote ${packs.length} packs to src/content/generated/.`);
