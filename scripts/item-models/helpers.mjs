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

/**
 * Builds the option list: the correct answer plus the first distractors whose text
 * differs from everything already used. Throws if there aren't enough, so a bad
 * parameter set can never produce a broken question.
 */
export function options(count, correct, distractors) {
  const out = [{ text: correct.text, correct: true, why: correct.why }];
  const seen = new Set([correct.text]);
  for (const d of distractors) {
    if (out.length === count) break;
    if (seen.has(d.text)) continue;
    seen.add(d.text);
    out.push({ text: d.text, trap: d.trap, why: d.why });
  }
  if (out.length < count) throw new Error(`not enough distinct options for "${correct.text}"`);
  return out;
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
