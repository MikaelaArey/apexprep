// LSAT formal logic: "every", "no", "only", "unless", "or" and "some" statements,
// with answers proved by a small model checker instead of keyed by hand.
//
// A model is a set of individual "types" (which of the scenario's 3–4 properties an
// individual has). A statement follows from the premises when no model of the
// premises breaks it. Every keyed answer must follow, every wrong answer must fail,
// and each wrong answer's explanation describes the counterexample the checker
// found. Anything that would turn on whether "every X" implies that some X exist is
// left out, so each key holds under either reading.

import { pick, seeded, shuffle, steps } from './helpers.mjs';

export const knowledgePoints = [];

// ---------- Logic ----------

const lit = (p, neg = false) => ({ p, neg });
const not = (L) => ({ p: L.p, neg: !L.neg });
const all = (a, b) => ({ kind: 'all', a, b });
const some = (a, b) => ({ kind: 'some', a, b });
const [A, B, C, D] = [0, 1, 2, 3].map((p) => lit(p));
const same = (x, y) => x.p === y.p && x.neg === y.neg;

const has = (t, L) => Boolean((t >> L.p) & 1) !== L.neg;
const fits = (t, s) => (s.kind === 'all' ? !has(t, s.a) || has(t, s.b) : has(t, s.a) && has(t, s.b));
const typesOf = (k) => [...Array(1 << k).keys()];

/** Types the universal premises allow, and the "some" needs a model must meet. */
function world(premises, k, imported) {
  const universals = premises.filter((s) => s.kind === 'all');
  const allowed = typesOf(k).filter((t) => universals.every((s) => fits(t, s)));
  const needs = premises.filter((s) => s.kind === 'some');
  // Read "every X is Y" as also saying some X, and some non-Y, exist (either
  // could be the grammatical subject once the statement is put into words).
  if (imported) for (const s of universals) needs.push(some(s.a, s.a), some(not(s.b), not(s.b)));
  return { allowed, needs };
}

function consistent(premises, k, imported = false) {
  const { allowed, needs } = world(premises, k, imported);
  return needs.every((n) => allowed.some((t) => fits(t, n)));
}

function entails(premises, k, s, imported = false) {
  if (!consistent(premises, k, imported)) throw new Error('premises are inconsistent');
  const { allowed, needs } = world(premises, k, imported);
  if (s.kind === 'all') return allowed.every((t) => fits(t, s));
  // A "some" conclusion is forced only if every possible witness of some need has it.
  return needs.some((n) => allowed.filter((t) => fits(t, n)).every((t) => fits(t, s)));
}

/** Statements that say the same thing (contrapositives, either order of "some") share a meaning. */
const meaning = (s, k) => s.kind + typesOf(k).map((t) => (fits(t, s) ? 1 : 0)).join('');

function* combos(pool, size, start = 0, acc = []) {
  if (acc.length === size) {
    yield acc;
    return;
  }
  for (let i = start; i < pool.length; i++) yield* combos(pool, size, i + 1, [...acc, pool[i]]);
}

/** Smallest model whose types all pass `ok`, reading "every X" as saying some X exist. */
function smallestModel(premises, k, ok = () => true) {
  const { allowed, needs } = world(premises, k, true);
  const pool = allowed.filter(ok);
  for (let size = 1; size <= Math.max(1, needs.length); size++) {
    for (const m of combos(pool, size)) if (needs.every((n) => m.some((t) => fits(t, n)))) return m;
  }
  throw new Error('no model');
}

/** Shortest chain of conditionals (and contrapositives) from one literal to another. */
function path(premises, from, to) {
  const edges = premises.filter((s) => s.kind === 'all').flatMap((s) => [[s.a, s.b], [not(s.b), not(s.a)]]);
  const key = (L) => `${L.p}${L.neg}`;
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (same(cur, to)) {
      const out = [];
      for (let L = cur; L; L = prev.get(key(L))) out.unshift(L);
      return out;
    }
    for (const [x, y] of edges) {
      if (same(x, cur) && !prev.has(key(y))) {
        prev.set(key(y), cur);
        queue.push(y);
      }
    }
  }
  return null;
}

/** Every distinct statement over pairs of the k properties. */
function candidates(k) {
  const lits = [...Array(k).keys()].flatMap((p) => [lit(p), lit(p, true)]);
  const seen = new Set();
  const out = [];
  for (const x of lits) {
    for (const y of lits) {
      if (x.p === y.p) continue;
      for (const s of [all(x, y), some(x, y)]) {
        const m = meaning(s, k);
        if (!seen.has(m)) {
          seen.add(m);
          out.push(s);
        }
      }
    }
  }
  return out;
}

const check = (ok, what) => {
  if (!ok) throw new Error(`lsat-logic: ${what}`);
};

// ---------- English ----------

const verb = (s, p, tag) => ({ s, p, ns: `does not ${p}`, np: `do not ${p}`, never: `never ${p}`, pAll: `all ${p}`, tag });
const be = (sg, pl, tag) => ({ s: `is ${sg}`, p: `are ${pl}`, ns: `is not ${sg}`, np: `are not ${pl}`, never: `are never ${pl}`, pAll: `are all ${pl}`, tag });
const was = (x, tag) => ({ s: `was ${x}`, p: `were ${x}`, ns: `was not ${x}`, np: `were not ${x}`, never: `were never ${x}`, pAll: `were all ${x}`, tag });
const past = (x, base, tag) => ({ s: x, p: x, ns: `did not ${base}`, np: `did not ${base}`, never: `never ${x}`, pAll: `all ${x}`, tag });
const perfect = (x, tag) => ({ s: `has ${x}`, p: `have ${x}`, ns: `has not ${x}`, np: `have not ${x}`, never: `have never ${x}`, pAll: `have all ${x}`, tag });

const person = (intro, sg, pl, a, preds) => ({ intro, sg, pl, a, rel: 'who', it: null, preds });
const thing = (intro, sg, pl, a, preds) => ({ intro, sg, pl, a, rel: 'that', it: 'it', preds });

const SCENARIOS = [
  person('At Linden High School', 'student', 'students', 'a', [
    verb('plays in the orchestra', 'play in the orchestra', 'orchestra'),
    verb('takes music theory', 'take music theory', 'theory'),
    verb('sings in the choir', 'sing in the choir', 'choir'),
    be('on the swim team', 'on the swim team', 'swim team'),
  ]),
  person('At Corvel Logistics', 'employee', 'employees', 'an', [
    verb('speaks Spanish', 'speak Spanish', 'Spanish'),
    verb('works in sales', 'work in sales', 'sales'),
    verb('has a company car', 'have a company car', 'company car'),
    past('attended the spring retreat', 'attend the spring retreat', 'retreat'),
  ]),
  thing('At the Harbor Animal Shelter', 'dog', 'dogs', 'a', [
    be('house-trained', 'house-trained', 'house-trained'),
    be('over five years old', 'over five years old', 'over five'),
    perfect('been vaccinated', 'vaccinated'),
    verb('gets along with cats', 'get along with cats', 'good with cats'),
  ]),
  thing('In the Varga Collection', 'painting', 'paintings', 'a', [
    was('painted before 1900', 'pre-1900'),
    be('on display', 'on display', 'on display'),
    perfect('been restored', 'restored'),
    be('insured', 'insured', 'insured'),
  ]),
  person('In the Fernhill Hiking Club', 'member', 'members', 'a', [
    verb('owns a tent', 'own a tent', 'tent'),
    perfect('climbed Mount Avery', 'Mount Avery'),
    verb('leads group hikes', 'lead group hikes', 'leads hikes'),
    be('certified in first aid', 'certified in first aid', 'first aid'),
  ]),
  thing('On Calder Street', 'restaurant', 'restaurants', 'a', [
    verb('serves breakfast', 'serve breakfast', 'breakfast'),
    verb('has outdoor seating', 'have outdoor seating', 'patio'),
    verb('takes reservations', 'take reservations', 'reservations'),
    be('open on Mondays', 'open on Mondays', 'Mondays'),
  ]),
  thing('On the Brightway car lot', 'car', 'cars', 'a', [
    be('electric', 'electric', 'electric'),
    verb('has heated seats', 'have heated seats', 'heated seats'),
    was('built after 2020', 'post-2020'),
    verb('comes with a warranty', 'come with a warranty', 'warranty'),
  ]),
  thing('In the Kessler Greenhouse', 'plant', 'plants', 'a', [
    verb('needs direct sunlight', 'need direct sunlight', 'full sun'),
    verb('flowers in spring', 'flower in spring', 'spring bloom'),
    be('native to the region', 'native to the region', 'native'),
    verb('requires daily watering', 'require daily watering', 'daily water'),
  ]),
  thing("On this year's Harwick Prize shortlist", 'novel', 'novels', 'a', [
    was('written by a first-time author', 'debut'),
    be('set in the future', 'set in the future', 'future'),
    perfect('been translated', 'translated'),
    was('published in paperback', 'paperback'),
  ]),
  thing('In the Lakeview building', 'apartment', 'apartments', 'an', [
    verb('has a balcony', 'have a balcony', 'balcony'),
    verb('allows pets', 'allow pets', 'pets'),
    verb('faces the lake', 'face the lake', 'lake view'),
    verb('has two bedrooms', 'have two bedrooms', 'two bedrooms'),
  ]),
  person('In the Riverside soccer league', 'player', 'players', 'a', [
    verb('plays defense', 'play defense', 'defense'),
    verb('wears contact lenses', 'wear contact lenses', 'contacts'),
    perfect('scored a goal this season', 'scored'),
    be('a team captain', 'team captains', 'captain'),
  ]),
  thing('At Danforth College', 'course', 'courses', 'a', [
    verb('requires a final paper', 'require a final paper', 'paper'),
    verb('meets on Fridays', 'meet on Fridays', 'Fridays'),
    be('taught by a visiting professor', 'taught by visiting professors', 'visiting prof'),
    verb('satisfies the science requirement', 'satisfy the science requirement', 'science credit'),
  ]),
  person('At the Oakmont food bank', 'volunteer', 'volunteers', 'a', [
    verb('drives a delivery route', 'drive a delivery route', 'driver'),
    verb('works the Saturday shift', 'work the Saturday shift', 'Saturday'),
    verb('speaks French', 'speak French', 'French'),
    perfect('completed safety training', 'trained'),
  ]),
  thing('At the Maple Marsh preserve', 'bird species', 'bird species', 'a', [
    verb('migrates south in winter', 'migrate south in winter', 'migrates'),
    verb('nests on the ground', 'nest on the ground', 'ground nest'),
    verb('eats insects', 'eat insects', 'insects'),
    be('protected by law', 'protected by law', 'protected'),
  ]),
  person('At Quillon Software', 'engineer', 'engineers', 'an', [
    verb('writes code in Rust', 'write code in Rust', 'Rust'),
    be('on the security team', 'on the security team', 'security'),
    verb('works remotely', 'work remotely', 'remote'),
    verb('mentors new hires', 'mentor new hires', 'mentor'),
  ]),
  person('At the Westbrook clinic', 'patient', 'patients', 'a', [
    verb('has a referral', 'have a referral', 'referral'),
    be('over sixty-five', 'over sixty-five', 'over 65'),
    past('received a flu shot', 'receive a flu shot', 'flu shot'),
    verb('sees Dr. Osei', 'see Dr. Osei', 'Osei'),
  ]),
  thing('On Birch Lane', 'house', 'houses', 'a', [
    verb('has solar panels', 'have solar panels', 'solar'),
    was('built before 1950', 'pre-1950'),
    verb('has a garage', 'have a garage', 'garage'),
    be('painted white', 'painted white', 'white'),
  ]),
  person("In Professor Ng's seminar", 'student', 'students', 'a', [
    verb('majors in history', 'major in history', 'history'),
    verb('speaks Mandarin', 'speak Mandarin', 'Mandarin'),
    past('presented in the first week', 'present in the first week', 'week one'),
    perfect('submitted a thesis proposal', 'proposal'),
  ]),
  thing('At the Corwin Science Museum', 'exhibit', 'exhibits', 'an', [
    be('interactive', 'interactive', 'interactive'),
    be('suitable for young children', 'suitable for young children', 'kid-friendly'),
    verb('features live animals', 'feature live animals', 'live animals'),
    verb('requires a separate ticket', 'require a separate ticket', 'ticket'),
  ]),
  thing('At Ember Tea House', 'tea', 'teas', 'a', [
    verb('contains caffeine', 'contain caffeine', 'caffeine'),
    be('sold loose-leaf', 'sold loose-leaf', 'loose-leaf'),
    be('grown in India', 'grown in India', 'India'),
    be('blended with spices', 'blended with spices', 'spiced'),
  ]),
  thing('At the Spoke Shop', 'bicycle', 'bicycles', 'a', [
    verb('has a carbon frame', 'have a carbon frame', 'carbon'),
    be('sold with a lock', 'sold with a lock', 'lock'),
    verb('has disc brakes', 'have disc brakes', 'disc brakes'),
    verb('weighs under ten kilograms', 'weigh under ten kilograms', 'under 10 kg'),
  ]),
  person('In the Ridgeway city council race', 'candidate', 'candidates', 'a', [
    verb('supports the transit plan', 'support the transit plan', 'transit'),
    perfect('held office before', 'experienced'),
    verb('lives downtown', 'live downtown', 'downtown'),
    was('endorsed by the Ridgeway Gazette', 'endorsed'),
  ]),
  thing("At this year's Northlight film festival", 'film', 'films', 'a', [
    be('a documentary', 'documentaries', 'documentary'),
    verb('runs under ninety minutes', 'run under ninety minutes', 'short'),
    be('in a language other than English', 'in languages other than English', 'foreign-language'),
    past('premiered at the festival', 'premiere at the festival', 'premiere'),
  ]),
  person('At Halden Public Library', 'cardholder', 'cardholders', 'a', [
    verb('borrows audiobooks', 'borrow audiobooks', 'audiobooks'),
    verb('volunteers at the book sale', 'volunteer at the book sale', 'book sale'),
    verb('lives outside the county', 'live outside the county', 'out-of-county'),
    past('joined before 2020', 'join before 2020', 'pre-2020'),
  ]),
];

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const low = (s) => s[0].toLowerCase() + s.slice(1);
const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')}, and ${xs.at(-1)}`);

/** Verb phrases for a literal: singular, plural and a short tag for diagrams. */
function v(sc, L) {
  const P = sc.preds[L.p];
  return L.neg ? { s: P.ns, p: P.np, tag: `not ${P.tag}` } : { s: P.s, p: P.p, tag: P.tag };
}

/** Ways to say "every x is y" for one orientation; contrapositive orientations add more. */
function allForms(sc, x, y) {
  const X = v(sc, x);
  const Y = v(sc, y);
  const it = sc.it ?? `that ${sc.sg}`;
  const forms = [`If ${sc.a} ${sc.sg} ${X.s}, then ${it} ${Y.s}.`];
  if (!y.neg) forms.push(`Every ${sc.sg} ${sc.rel} ${X.s} ${Y.s}.`, `${cap(sc.pl)} ${sc.rel} ${X.p} ${sc.preds[y.p].pAll}.`);
  if (!x.neg && !y.neg) {
    forms.push(
      `Only ${sc.pl} ${sc.rel} ${Y.p} ${X.p}.`,
      `No ${sc.sg} ${X.s} unless ${it} ${Y.s}.`,
      `Unless ${sc.a} ${sc.sg} ${Y.s}, ${it} ${v(sc, not(x)).s}.`,
    );
  }
  if (y.neg) {
    const Y1 = v(sc, not(y));
    forms.push(`No ${sc.sg} ${sc.rel} ${X.s} ${Y1.s}.`, `None of the ${sc.pl} ${sc.rel} ${X.p} ${Y1.p}.`);
    if (!x.neg) forms.push(`${cap(sc.pl)} ${sc.rel} ${X.p} ${sc.preds[y.p].never}.`);
  }
  if (x.neg && !y.neg) forms.push(`Every ${sc.sg} ${v(sc, not(x)).s}, ${Y.s}, or both.`);
  return forms;
}

function sayAll(sc, s, r, orient = null) {
  const choices = [];
  for (const [x, y] of orient ? [orient] : [[s.a, s.b], [not(s.b), not(s.a)]]) {
    for (const text of allForms(sc, x, y)) choices.push({ text, x, y });
  }
  return pick(choices, r);
}

function saySome(sc, s, r) {
  let [x, y] = r() < 0.5 ? [s.a, s.b] : [s.b, s.a];
  if (x.neg && !y.neg) [x, y] = [y, x];
  const text =
    r() < 0.75 ? `Some ${sc.pl} ${sc.rel} ${v(sc, x).p} ${v(sc, y).p}.` : `At least one ${sc.sg} ${sc.rel} ${v(sc, x).s} ${v(sc, y).s}.`;
  return { text, x, y };
}

const say = (sc, s, r) => (s.kind === 'all' ? sayAll(sc, s, r) : saySome(sc, s, r)).text;

/** Plain-English versions used inside explanations. */
function plainAll(sc, s) {
  return s.b.neg
    ? `no ${sc.sg} ${sc.rel} ${v(sc, s.a).s} ${v(sc, not(s.b)).s}`
    : `every ${sc.sg} ${sc.rel} ${v(sc, s.a).s} ${v(sc, s.b).s}`;
}
function plainSome(sc, s) {
  const [x, y] = s.a.neg && !s.b.neg ? [s.b, s.a] : [s.a, s.b];
  return `some ${sc.pl} ${sc.rel} ${v(sc, x).p} ${v(sc, y).p}`;
}

/** Diagram notation: "orchestra → theory", "orchestra ←some→ theory". */
const note = (sc, s) => (s.kind === 'all' ? `${v(sc, s.a).tag} → ${v(sc, s.b).tag}` : `${v(sc, s.a).tag} ←some→ ${v(sc, s.b).tag}`);
const chainNote = (sc, chain) => chain.map((L) => v(sc, L).tag).join(' → ');

const describe = (sc, t, k) => list([...Array(k).keys()].map((p) => v(sc, lit(p, !((t >> p) & 1))).s));
const kind = (sc, t, k) => [...Array(k).keys()].map((p) => v(sc, lit(p, !((t >> p) & 1))).tag).join(' + ');

/** A random individual the universal statements allow but that breaks `s`. */
function counterIndividual(sc, premises, k, s, r) {
  const t = pick(world(premises, k, false).allowed.filter((u) => !fits(u, s)), r);
  return `${sc.a} ${sc.sg} ${sc.rel} ${describe(sc, t, k)}`;
}

/** "a painting that was painted before 1900 and is not on display" */
const oneThat = (sc, x, y) => `${sc.a} ${sc.sg} ${sc.rel} ${v(sc, x).s} and ${v(sc, y).s}`;

/** The smallest population (in diagram tags) where every statement holds and each group mentioned exists. */
function arrangement(sc, premises, k) {
  const m = smallestModel(premises, k);
  if (m.length === 1) return `if every ${sc.sg} were ${kind(sc, m[0], k)}`;
  const n = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][m.length];
  return `with just ${n} kinds of ${sc.pl} (${m.map((t) => kind(sc, t, k)).join('; ')})`;
}

/** Proof that a "some" statement follows: start from a promised group and chain forward. */
function someProof(sc, premises, target) {
  for (const w of premises.filter((s) => s.kind === 'some')) {
    for (const [u, z] of [[w.a, w.b], [w.b, w.a]]) {
      for (const [x, y] of [[target.a, target.b], [target.b, target.a]]) {
        if (!same(u, x)) continue;
        const chain = path(premises, z, y);
        if (chain && chain.length > 1) return { u, z, x, y, chain };
      }
    }
  }
  throw new Error('lsat-logic: no proof found for a "some" conclusion');
}

const group = (sc, u, z) => `${sc.pl} ${sc.rel} ${v(sc, u).p} and ${v(sc, z).p}`;

/** Picks the answer's scenario: a few of its properties in a seeded order. */
function instance(sc, k, r) {
  return { ...sc, preds: shuffle(sc.preds, r).slice(0, k) };
}

/** Renders the premises; returns the text and the sentences, so answers can avoid repeating one word for word. */
function stimulus(sc, premises, r) {
  const sentences = shuffle(premises, r).map((s) => say(sc, s, r));
  const text = [`${sc.intro}, ${low(sentences[0])}`, ...sentences.slice(1)].join(' ');
  return { text, sentences };
}

/** Says a statement in a way that doesn't copy any sentence in `avoid`. */
function fresh(sc, s, r, avoid) {
  for (let i = 0; i < 12; i++) {
    const shown = s.kind === 'all' ? sayAll(sc, s, r) : saySome(sc, s, r);
    if (!avoid.includes(shown.text)) return shown;
  }
  throw new Error('lsat-logic: could not reword an answer');
}

/** Picks four distractors, favoring the most tempting kinds without piling up one kind. */
function choose(pool, r, caps) {
  const ranked = pool.map((d) => ({ ...d, rank: d.score + r() * 2 })).sort((a, b) => b.rank - a.rank);
  const out = [];
  const count = {};
  for (const d of ranked) {
    if (out.length === 4) break;
    if ((count[d.trap] ?? 0) >= (caps[d.trap] ?? 2)) continue;
    count[d.trap] = (count[d.trap] ?? 0) + 1;
    out.push(d);
  }
  for (const d of ranked) if (out.length < 4 && !out.includes(d)) out.push(d);
  check(out.length === 4, 'not enough distractors');
  return out;
}

const option = (text, why, trap = null) => (trap ? { text, trap, why } : { text, correct: true, why });

// ---------- Must be true ----------

const MBT = [
  { model: 'chain', k: 3, premises: [all(A, B), all(B, C)], keys: [[A, C], [not(C), not(A)]], difficulty: 2,
    takeaway: 'Chain conditionals end to end. The contrapositive (flip both sides and negate them) says the same thing; the plain reversal does not.' },
  { model: 'chain-no', k: 3, premises: [all(A, B), all(B, not(C))], keys: [[A, not(C)], [C, not(A)]], difficulty: 3,
    takeaway: '"No X is Y" means X → not Y and, equally, Y → not X. Use whichever direction extends the chain.' },
  { model: 'chain-or', k: 3, premises: [all(not(A), B), all(B, C)], keys: [[not(C), A]], difficulty: 3,
    takeaway: '"Each is X, Y, or both" means not X → Y. Turn "or" into a conditional, then chain.' },
  { model: 'chain-4', k: 4, premises: [all(A, B), all(B, C), all(C, not(D))], keys: [[A, not(D)], [D, not(A)]], difficulty: 4,
    takeaway: 'Long chains are just short ones linked. Diagram each statement, then follow the arrows, contrapositives included.' },
  { model: 'fork-no', k: 4, premises: [all(A, B), all(C, not(B)), all(D, C)], keys: [[D, not(A)], [A, not(D)]], difficulty: 4,
    takeaway: 'When two chains share a term with opposite signs, a contrapositive usually connects them.' },
  { model: 'some-all', k: 3, premises: [some(A, B), all(B, C)], some: [A, C], difficulty: 3,
    takeaway: '"Some X are Y" plus "every Y is Z" gives "some X are Z." Chain forward from the "some" group, never backward.' },
  { model: 'some-no', k: 3, premises: [some(A, B), all(B, not(C))], some: [A, not(C)], difficulty: 3,
    takeaway: '"Some X are Y" plus "no Y is Z" gives "some X are not Z." Nothing follows about the Z group itself.' },
  { model: 'some-chain', k: 4, premises: [some(A, B), all(B, C), all(C, D)], some: [A, D], difficulty: 4,
    takeaway: 'A "some" group carries every property its members are guaranteed, however long the chain.' },
];

const MBT_PROMPTS = [
  'If the statements above are true, which one of the following must also be true?',
  'Which one of the following must be true on the basis of the statements above?',
  'If the statements above are true, which one of the following must be true?',
];

/** Labels a wrong answer by how it goes wrong, judged by the way it's actually worded. */
function classifyMbt(sc, premises, k, c, shown, key, r) {
  const { x, y } = shown;
  if (!consistent([...premises, c], k)) {
    const why =
      c.kind === 'all'
        ? `Can't be true: the statements guarantee that ${plainSome(sc, some(x, not(y)))}.`
        : `Can't be true: ${plainAll(sc, all(x, not(y)))}.`;
    return { trap: 'contradicts', score: 6, why };
  }
  if (c.kind === 'some') return { trap: 'unsupported', score: 4, why: `Not forced: nothing guarantees ${oneThat(sc, x, y)}.` };
  if (entails(premises, k, all(y, x))) {
    const what = x.neg && y.neg ? `This negates both sides of ${note(sc, all(not(x), not(y)))} without flipping them` : `This reverses ${note(sc, all(y, x))}`;
    const ofKey = meaning(all(y, x), k) === meaning(key, k);
    return { trap: 'reversal', score: ofKey ? 9 : 8, why: `${what}: ${counterIndividual(sc, premises, k, c, r)} breaks none of the rules but makes this false.` };
  }
  for (const [p, q] of [[x, y], [not(y), not(x)]]) {
    if (entails(premises, k, some(p, q))) {
      const restated = p === x ? '' : ` It amounts to "${cap(plainAll(sc, all(p, q)))}."`;
      return { trap: 'too_strong', score: 7, why: `Too strong.${restated} The statements show only that ${plainSome(sc, some(p, q))}.` };
    }
  }
  if (entails(premises, k, all(x, not(y)))) {
    return { trap: 'contradicts', score: 6, why: `The statements imply the opposite: ${plainAll(sc, all(x, not(y)))}.` };
  }
  return { trap: 'unsupported', score: 5, why: `Not forced: ${counterIndividual(sc, premises, k, c, r)} breaks none of the rules but makes this false.` };
}

function buildMbt(make, spec, base, seed) {
  const r = seeded(seed);
  const { k, premises } = spec;
  const sc = instance(base, k, r);
  check(consistent(premises, k, true), `${spec.model} premises are inconsistent`);
  const stim = stimulus(sc, premises, r);
  let key, keyText, keyWhy, tldr, combine;
  if (spec.keys) {
    const [x, y] = pick(spec.keys, r);
    key = all(x, y);
    check(entails(premises, k, key), `${spec.model} key doesn't follow`);
    keyText = sayAll(sc, key, r, [x, y]).text;
    keyWhy = `Follows: ${chainNote(sc, path(premises, x, y))}.`;
    const flipped = x.neg && y.neg;
    const [fx, fy] = flipped ? [not(y), not(x)] : [x, y];
    const forward = chainNote(sc, path(premises, fx, fy));
    tldr = flipped ? `Chain it: ${forward}. The answer is its contrapositive, ${note(sc, key)}.` : `Chain it: ${forward}. The answer says ${note(sc, key)}.`;
    combine = flipped ? `${forward}; contrapositive: ${note(sc, key)}.` : `${forward}.`;
  } else {
    key = some(...spec.some);
    check(entails(premises, k, key), `${spec.model} key doesn't follow`);
    keyText = saySome(sc, key, r).text;
    const pr = someProof(sc, premises, key);
    keyWhy = `Follows: ${plainSome(sc, some(pr.u, pr.z))}, and ${plainAll(sc, all(pr.z, pr.y))}.`;
    tldr = `Chain from the "some" group: ${note(sc, some(pr.u, pr.z))}, and ${chainNote(sc, pr.chain)}, so ${note(sc, some(pr.x, pr.y))}.`;
    combine = `Start from the "some" group (${v(sc, pr.u).tag} + ${v(sc, pr.z).tag}) and follow it: ${chainNote(sc, pr.chain)}.`;
  }
  const hasSome = premises.some((s) => s.kind === 'some');
  const pool = [];
  for (const c of candidates(k)) {
    if (c.kind === 'some' && !hasSome) continue;
    if (entails(premises, k, c, true)) continue;
    const shown = fresh(sc, c, r, stim.sentences);
    pool.push({ c, text: shown.text, ...classifyMbt(sc, premises, k, c, shown, key, r) });
  }
  const picked = choose(pool, r, { reversal: 2, contradicts: 1, too_strong: 1, unsupported: 2 });
  make({
    type: 'must_be_true',
    model: `lr-logic-${spec.model}`,
    kps: hasSome ? ['kp-lsat-quantifiers', 'kp-lsat-contrapositive'] : ['kp-lsat-contrapositive'],
    difficulty: spec.difficulty,
    stimulus: stim.text,
    prompt: pick(MBT_PROMPTS, r),
    options: [option(keyText, keyWhy), ...picked.map((d) => option(d.text, d.why, d.trap))],
    tldr,
    steps: steps(
      ['Translate', `${premises.map((s) => note(sc, s)).join('; ')}.`],
      ['Combine', combine],
      ['Rule out the rest', 'Each wrong answer can be false: its explanation describes a case that fits every statement but breaks it.'],
    ),
    takeaway: spec.takeaway,
  });
}

// ---------- Sufficient assumption ----------

const SA = [
  { model: 'sa-chain', k: 3, premises: [all(A, B)], conclusion: all(A, C), key: all(B, C), difficulty: 3 },
  { model: 'sa-front', k: 3, premises: [all(B, C)], conclusion: all(A, C), key: all(A, B), difficulty: 3 },
  { model: 'sa-no', k: 3, premises: [all(A, B)], conclusion: all(A, not(C)), key: all(B, not(C)), difficulty: 3 },
  { model: 'sa-some', k: 3, premises: [some(A, B)], conclusion: some(A, C), key: all(B, C), difficulty: 3 },
  { model: 'sa-some-no', k: 3, premises: [some(A, B)], conclusion: some(A, not(C)), key: all(B, not(C)), difficulty: 4 },
  { model: 'sa-gap', k: 4, premises: [all(A, B), all(C, D)], conclusion: all(A, D), key: all(B, C), difficulty: 4 },
];

const SA_PROMPTS = [
  'The conclusion of the argument follows logically if which one of the following is assumed?',
  'Which one of the following, if assumed, enables the conclusion above to be properly drawn?',
  'The conclusion drawn above follows logically if which one of the following is assumed?',
];
const THEREFORE = ['So', 'Therefore,', 'Hence,', 'It follows that'];

function buildSa(make, spec, base, seed) {
  const r = seeded(seed);
  const { k, premises, conclusion: q, key } = spec;
  const sc = instance(base, k, r);
  const withKey = [...premises, key];
  check(consistent(withKey, k, true) && entails(withKey, k, q), `${spec.model} key isn't sufficient`);
  check(!entails(premises, k, q, true), `${spec.model} conclusion already follows`);
  const stim = stimulus(sc, premises, r);
  const conclusionText = say(sc, q, r);
  const avoid = [...stim.sentences, conclusionText];
  const pool = [];
  for (const c of candidates(k)) {
    if (meaning(c, k) === meaning(q, k)) continue;
    const plus = [...premises, c];
    if (!consistent(plus, k, true) || entails(plus, k, q, true)) continue;
    let [trap, score, lead] = ['too_weak', 3, 'Not enough'];
    if (premises.some((p) => meaning(p, k) === meaning(c, k))) [trap, score, lead] = ['restates_premise', 8, 'This only restates a premise'];
    else if (c.kind === 'all' && meaning(c, k) === meaning(all(key.b, key.a), k)) [trap, score, lead] = ['reversal', 9, 'Wrong direction'];
    else if (c.kind === 'some' && meaning(c, k) === meaning(some(key.a, key.b), k)) [trap, score, lead] = ['too_weak', 8, 'Too weak'];
    else if (c.kind === 'all' && q.kind === 'all' && meaning(c, k) === meaning(all(q.b, q.a), k)) [trap, score, lead] = ['reversal', 7, 'This reverses the conclusion'];
    else if (c.kind === 'some') continue; // other "some" answers are too easy to dismiss
    const why =
      q.kind === 'all'
        ? `${lead}. Even with it, ${counterIndividual(sc, plus, k, q, r)} fits every premise but breaks the conclusion.`
        : `${lead}. Even with it, nothing guarantees ${oneThat(sc, q.a, q.b)}, which the conclusion needs.`;
    pool.push({ c, text: fresh(sc, c, r, avoid).text, trap, score, why });
  }
  const picked = choose(pool, r, { reversal: 2, restates_premise: 1, too_weak: 2 });
  let keyWhy;
  let bridge;
  if (q.kind === 'all') {
    const chain = chainNote(sc, path(withKey, q.a, q.b));
    keyWhy = `With it, the chain is complete: ${chain}.`;
    bridge = `Adding ${note(sc, key)} completes ${chain}.`;
  } else {
    const pr = someProof(sc, withKey, q);
    keyWhy = `With it, each of the ${group(sc, pr.u, pr.z)} ${v(sc, pr.y).s}, which is the conclusion.`;
    bridge = `The "some" group (${v(sc, pr.u).tag} + ${v(sc, pr.z).tag}) needs ${note(sc, key)} to reach ${v(sc, pr.y).tag}.`;
  }
  make({
    type: 'sufficient_assumption',
    model: `lr-logic-${spec.model}`,
    kps: ['kp-lsat-sufficient-bridge'],
    difficulty: spec.difficulty,
    stimulus: `${stim.text} ${pick(THEREFORE, r)} ${low(conclusionText)}`,
    prompt: pick(SA_PROMPTS, r),
    options: [option(fresh(sc, key, r, avoid).text, keyWhy), ...picked.map((d) => option(d.text, d.why, d.trap))],
    tldr: `Bridge the gap: the argument needs ${note(sc, key)} to reach ${note(sc, q)}.`,
    steps: steps(
      ['Map the argument', `Premises: ${premises.map((s) => note(sc, s)).join('; ')}. Conclusion: ${note(sc, q)}.`],
      ['Bridge', bridge],
      ['Test the rest', 'Each wrong answer leaves a case that fits the premises but breaks the conclusion.'],
    ),
    takeaway: 'A sufficient assumption makes the conclusion airtight. Find the term the premises never reach, and connect to it in the right direction.',
  });
}

// ---------- Must be false ----------

const MBF = [
  { model: 'mbf-some-all', k: 3, premises: [some(A, B), all(B, C)], key: all(A, not(C)), difficulty: 3 },
  { model: 'mbf-some-no', k: 3, premises: [some(A, B), all(B, not(C))], key: all(A, C), difficulty: 3 },
  { model: 'mbf-chain', k: 4, premises: [all(A, B), all(B, C), some(D, A)], key: all(D, not(C)), difficulty: 4 },
];

function buildMbf(make, spec, base, seed) {
  const r = seeded(seed);
  const { k, premises, key } = spec;
  const sc = instance(base, k, r);
  check(consistent(premises, k, true) && !consistent([...premises, key], k), `${spec.model} key isn't impossible`);
  const stim = stimulus(sc, premises, r);
  const pool = [];
  for (const c of candidates(k)) {
    if (!consistent([...premises, c], k, true) || entails(premises, k, c, true)) continue;
    const why = `Could be true: ${arrangement(sc, [...premises, c], k)}, this and every statement would hold.`;
    const touches = [key.a.p, key.b.p].filter((p) => p === c.a.p || p === c.b.p).length;
    pool.push({ c, text: fresh(sc, c, r, stim.sentences).text, trap: 'unsupported', score: touches * 2 + r(), why });
  }
  const picked = choose(pool, r, { unsupported: 4 });
  const target = some(key.a, not(key.b));
  const pr = someProof(sc, premises, target);
  make({
    type: 'must_be_false',
    model: `lr-logic-${spec.model}`,
    kps: ['kp-lsat-must-be-false', 'kp-lsat-quantifiers'],
    difficulty: spec.difficulty,
    stimulus: stim.text,
    prompt:
      r() < 0.5
        ? 'If the statements above are true, each of the following could be true EXCEPT:'
        : 'If the statements above are true, which one of the following must be false?',
    options: [
      option(fresh(sc, key, r, stim.sentences).text, `Must be false: ${plainSome(sc, some(pr.u, pr.z))}, and ${plainAll(sc, all(pr.z, pr.y))}, so ${plainSome(sc, target)}.`),
      ...picked.map((d) => option(d.text, d.why, d.trap)),
    ],
    tldr: `${cap(note(sc, some(pr.u, pr.z)))} and ${chainNote(sc, pr.chain)}, so ${note(sc, target)}. The answer that denies this must be false.`,
    steps: steps(
      ['Translate', `${premises.map((s) => note(sc, s)).join('; ')}.`],
      ['Use the "some" group', `The ${group(sc, pr.u, pr.z)} exist, and each one ${v(sc, pr.y).s} (${chainNote(sc, pr.chain)}).`],
      ['Find the clash', 'Only one answer rules out that group. Each of the others fits some arrangement of the facts.'],
    ),
    takeaway: 'For "must be false," find who the statements guarantee exists, then find the answer that rules them out.',
  });
}


// ---------- Parallel reasoning and parallel flaw ----------

const ARGS = {
  chain: { premises: [all(A, B), all(B, C)], conclusion: all(A, C), valid: true, pattern: 'P → Q, Q → R; so P → R' },
  chainNo: { premises: [all(A, B), all(B, not(C))], conclusion: all(C, not(A)), valid: true, pattern: 'P → Q, Q → not R; so R → not P' },
  someAll: { premises: [some(A, B), all(B, C)], conclusion: some(A, C), valid: true, pattern: 'some P are Q, Q → R; so some P are R' },
  converse: { premises: [all(A, B), all(B, C)], conclusion: all(C, A), valid: false, pattern: 'P → Q, Q → R; so R → P',
    flaw: 'The conclusion reverses the chain; R → P doesn’t follow from P → R.' },
  shared: { premises: [all(A, B), all(C, B)], conclusion: all(A, C), valid: false, pattern: 'P → Q, R → Q; so P → R',
    flaw: 'Sharing a requirement (Q) doesn’t link P to R.' },
  fork: { premises: [all(A, B), all(A, C)], conclusion: all(B, C), valid: false, pattern: 'P → Q, P → R; so Q → R',
    flaw: 'Two requirements of P needn’t be linked to each other.' },
  someSome: { premises: [some(A, B), some(B, C)], conclusion: some(A, C), valid: false, pattern: 'some P are Q, some Q are R; so some P are R',
    flaw: 'The two "some" groups may not overlap.' },
  someBack: { premises: [some(A, B), all(C, B)], conclusion: some(A, C), valid: false, pattern: 'some P are Q, R → Q; so some P are R',
    flaw: 'R → Q runs into Q, not out of it, so nothing links the "some" group to R.' },
};
for (const [name, arg] of Object.entries(ARGS)) {
  check(consistent(arg.premises, 3, true), `${name} premises are inconsistent`);
  check(arg.valid ? entails(arg.premises, 3, arg.conclusion) : !entails(arg.premises, 3, arg.conclusion, true), `${name} validity`);
}

const PARALLEL = [
  { model: 'pr-chain', type: 'parallel_reasoning', stim: 'chain', others: ['converse', 'shared', 'fork', 'someAll'], difficulty: 3 },
  { model: 'pr-chain-no', type: 'parallel_reasoning', stim: 'chainNo', others: ['converse', 'shared', 'someBack', 'fork'], difficulty: 4 },
  { model: 'pr-some', type: 'parallel_reasoning', stim: 'someAll', others: ['someSome', 'someBack', 'chain', 'converse'], difficulty: 4 },
  { model: 'pf-converse', type: 'parallel_flaw', stim: 'converse', others: ['chain', 'shared', 'fork', 'someAll'], difficulty: 3 },
  { model: 'pf-shared', type: 'parallel_flaw', stim: 'shared', others: ['chain', 'converse', 'fork', 'someSome'], difficulty: 4 },
  { model: 'pf-fork', type: 'parallel_flaw', stim: 'fork', others: ['chain', 'shared', 'converse', 'someBack'], difficulty: 4 },
  { model: 'pf-some', type: 'parallel_flaw', stim: 'someSome', others: ['someAll', 'someBack', 'converse', 'chain'], difficulty: 4 },
];

function argumentText(sc, arg, r, withIntro) {
  const body = shuffle(arg.premises, r).map((s) => say(sc, s, r));
  if (withIntro) body[0] = `${sc.intro}, ${low(body[0])}`;
  return `${body.join(' ')} ${pick(THEREFORE, r)} ${low(say(sc, arg.conclusion, r))}`;
}

function buildParallel(make, spec, scenarios, seed) {
  const r = seeded(seed);
  const [s0, s1, ...rest] = scenarios.map((sc) => instance(sc, 3, r));
  const stim = ARGS[spec.stim];
  const flawed = spec.type === 'parallel_flaw';
  const keyWhy = flawed ? `Same flaw: ${stim.pattern}. ${stim.flaw}` : `Same valid pattern: ${stim.pattern}.`;
  const wrong = spec.others.map((name, i) => {
    const arg = ARGS[name];
    let why;
    if (arg.valid) why = flawed ? `This one is valid (${arg.pattern}), so it doesn't share the flaw.` : `Valid, but a different pattern: ${arg.pattern}.`;
    else why = `${flawed ? 'A different flaw' : 'Invalid'}: ${arg.pattern}. ${arg.flaw}`;
    return option(argumentText(rest[i], arg, r, false), why, 'different_structure');
  });
  make({
    type: spec.type,
    model: `lr-logic-${spec.model}`,
    kps: ['kp-lsat-parallel-structure'],
    difficulty: spec.difficulty,
    stimulus: argumentText(s0, stim, r, true),
    prompt: flawed
      ? 'The flawed pattern of reasoning in the argument above is most similar to that in which one of the following arguments?'
      : 'Which one of the following arguments is most similar in its pattern of reasoning to the argument above?',
    options: [option(argumentText(s1, stim, r, false), keyWhy), ...wrong],
    tldr: flawed ? `Pattern: ${stim.pattern}. ${stim.flaw}` : `Pattern: ${stim.pattern}. Match both the form and the validity.`,
    steps: steps(
      ['Abstract the argument', `${stim.pattern}.`],
      ['Compare', flawed
        ? 'Diagram each answer the same way. Valid arguments and different flaws are out.'
        : 'Diagram each answer the same way. Only one has the same form and is valid.'],
    ),
    takeaway: 'Parallel questions test form, not topic. Reduce each argument to letters and arrows before comparing.',
  });
}

// ---------- Build ----------

export function build(make) {
  let n = 0;
  const next = () => SCENARIOS[n++ % SCENARIOS.length];
  for (const spec of MBT) for (let i = 0; i < 5; i++) buildMbt(make, spec, next(), `mbt-${spec.model}-${i}`);
  for (const spec of SA) for (let i = 0; i < 3; i++) buildSa(make, spec, next(), `sa-${spec.model}-${i}`);
  for (const spec of MBF) for (let i = 0; i < 5; i++) buildMbf(make, spec, next(), `mbf-${spec.model}-${i}`);
  for (const spec of PARALLEL) {
    for (let i = 0; i < 3; i++) {
      const scenarios = Array.from({ length: 6 }, next);
      buildParallel(make, spec, scenarios, `par-${spec.model}-${i}`);
    }
  }
}
