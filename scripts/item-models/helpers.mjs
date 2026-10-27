// Shared helpers for item models: number formatting and option assembly.

/** Formats a number without float noise: fmt(0.4000001) → "0.4", fmt(-2) → "−2". */
export function fmt(x, maxDecimals = 2) {
  const rounded = Number((x + Math.sign(x) * 1e-9).toFixed(maxDecimals));
  const text = String(Math.abs(rounded) < 1e-12 ? 0 : rounded);
  return text.startsWith('-') ? `−${text.slice(1)}` : text;
}

/** Fixed number of decimals, e.g. pH values: fixed(5.76, 2) → "5.76". */
export function fixed(x, decimals) {
  // Nudge away from binary-float ties so 2.765 prints as 2.77, like the textbooks.
  const t = (x + Math.sign(x) * 1e-9).toFixed(decimals);
  return t.startsWith('-') ? `−${t.slice(1)}` : t;
}

/** Answer texts the build treats as numbers (and sorts ascending), e.g. "4.28", "40 A", "17%". */
export const NUMERIC = /^[−-]?\d[\d,]*(\.\d+)?(\s|%|$)/;

const SUPERSCRIPT = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

/** The value of a numeric answer text, reading "2.0 × 10⁸" as 2.0e8. */
export function numericValue(text) {
  const t = text.replace(/,/g, '').replace(/^−/, '-');
  const sci = t.match(/^(-?\d+(?:\.\d+)?)\s*×\s*10(⁻?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/);
  if (sci) {
    const exp = [...sci[3]].reduce((n, ch) => n * 10 + SUPERSCRIPT[ch], 0);
    return parseFloat(sci[1]) * 10 ** (sci[2] ? -exp : exp);
  }
  return parseFloat(t);
}

function* subsets(n, k, start = 0) {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= n - k; i++) for (const rest of subsets(n, k - 1, i + 1)) yield [i, ...rest];
}

/**
 * Numeric answers are shown sorted, so the distractors decide where the correct
 * answer lands. Common-error distractors tend to straddle the answer, which would
 * put it in the middle almost every time. Each numeric question therefore takes the
 * reachable slot used least so far in this run (ties broken by its own text), and
 * the earliest-listed distractors that land it there.
 */
const slotsUsed = new Map();
function balanced(correct, pool, k) {
  const value = numericValue(correct.text);
  const isBelow = pool.map((d) => numericValue(d.text) < value);
  const below = isBelow.filter(Boolean).length;
  const lo = Math.max(0, k - (pool.length - below));
  const hi = Math.min(k, below);
  if (!slotsUsed.has(k)) slotsUsed.set(k, new Array(k + 1).fill(0));
  const used = slotsUsed.get(k);
  const r = seeded(`${correct.text}|${pool.map((d) => d.text).join('|')}`);
  let target = lo;
  let bestKey = Infinity;
  for (let slot = lo; slot <= hi; slot++) {
    const key = used[slot] + r() * 0.5;
    if (key < bestKey) [target, bestKey] = [slot, key];
  }
  used[target]++;
  let best = null;
  for (const subset of subsets(pool.length, k)) {
    if (subset.filter((i) => isBelow[i]).length !== target) continue;
    const cost = subset.reduce((a, i) => a + i, 0);
    if (!best || cost < best.cost) best = { subset, cost };
  }
  return best.subset.map((i) => pool[i]);
}

/**
 * Builds the option list: the correct answer plus distractors whose text differs
 * from everything already used. Throws if there aren't enough, so a bad parameter
 * set can never produce a broken question. Text answers take the first distractors
 * listed; numeric answers take the ones that spread the answer's slot evenly.
 */
export function options(count, correct, distractors) {
  const pool = [];
  const seen = new Set([correct.text]);
  for (const d of distractors) {
    if (seen.has(d.text)) continue;
    seen.add(d.text);
    pool.push(d);
  }
  if (pool.length < count - 1) throw new Error(`not enough distinct options for "${correct.text}"`);
  const numeric = [correct, ...pool].every((o) => NUMERIC.test(o.text));
  const chosen = numeric ? balanced(correct, pool, count - 1) : pool.slice(0, count - 1);
  return [{ text: correct.text, correct: true, why: correct.why }, ...chosen.map((d) => ({ text: d.text, trap: d.trap, why: d.why }))];
}

export const steps = (...pairs) => pairs.map(([label, body]) => ({ label, body }));

/** Simplest fraction for probabilities like 0.1875 → "3/16". */
export function fraction(x) {
  for (let d = 1; d <= 64; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return n === 0 ? '0' : `${n}/${d}`;
  }
  return fmt(x, 3);
}

export const pct = (x, decimals = 0) => `${fmt(x * 100, decimals)}%`;

/** Deterministic random numbers from a text seed (FNV-1a hash into mulberry32). */
export function seeded(text) {
  let a = 0x811c9dc5;
  for (const ch of String(text)) {
    a ^= ch.codePointAt(0);
    a = Math.imul(a, 0x01000193) >>> 0;
  }
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (list, r) => list[Math.floor(r() * list.length)];

export function shuffle(list, r) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
