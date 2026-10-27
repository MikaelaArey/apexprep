// Psych/Soc item models: research statistics, Weber's law and demographic rates.

import { fmt, fraction, options, pct, steps } from './helpers.mjs';

export const knowledgePoints = [
  ['kp-mcat-normal-distribution', 'The 68–95–99.7 rule', 'In a normal distribution, what share of scores falls within 1, 2 and 3 standard deviations of the mean?', 'About 68%, 95% and 99.7%. So about 16% lie above +1 SD and 2.5% above +2 SD.'],
  ['kp-mcat-z-scores', 'z-scores', 'How do you convert a raw score to a z-score?', 'z = (score − mean)/SD. A z of +2 sits near the 97.5th percentile.'],
  ['kp-mcat-central-tendency', 'Mean, median and skew', 'In a right-skewed distribution, how do the mean and median compare?', 'The long right tail pulls the mean above the median (and the median above the mode). The median resists outliers.'],
  ['kp-mcat-correlation-strength', 'Reading correlations', 'Which is the stronger correlation: r = −0.8 or r = +0.5? How much variance does r = 0.5 explain?', 'Strength is |r|, so −0.8 is stronger. r² is the variance explained: 0.5² = 25%.'],
  ['kp-mcat-probability', 'Probability of independent events', 'How do you combine probabilities of independent events?', 'Both happen: multiply. At least one happens: 1 − P(neither).'],
  ['kp-mcat-weber', 'Weber’s law', 'If the just-noticeable difference for 100 g is 2 g, what is it for 400 g?', '8 g. The JND is a constant fraction (here 2%) of the original stimulus.'],
  ['kp-mcat-demographic-rates', 'Demographic rates', 'How are crude birth rates and doubling times calculated?', 'Crude rate = events per 1,000 people per year. Doubling time ≈ 70 ÷ annual growth rate (%).'],
];

export function build(make) {
  // 1. Normal distribution areas
  for (const [ask, ans, why, wrong] of [
    ['fall within one standard deviation of the mean', 0.68, 'About 68% of scores lie within ±1 SD.', [0.95, 0.5, 0.34]],
    ['fall within two standard deviations of the mean', 0.95, 'About 95% of scores lie within ±2 SD.', [0.68, 0.997, 0.475]],
    ['fall more than one standard deviation above the mean', 0.16, '68% lie within ±1 SD, so 32% are outside, split evenly: 16% above.', [0.32, 0.34, 0.5]],
    ['fall more than two standard deviations below the mean', 0.025, '95% lie within ±2 SD; the remaining 5% splits into 2.5% in each tail.', [0.05, 0.16, 0.0015]],
    ['fall between the mean and one standard deviation above it', 0.34, 'Half of the 68% within ±1 SD: 34%.', [0.68, 0.16, 0.5]],
  ]) {
    make({
      type: 'statistics',
      kps: ['kp-mcat-normal-distribution'],
      outline: { sirs: 4 },
      difficulty: 1,
      prompt: `Scores on a test are normally distributed. Approximately what percentage of scores ${ask}?`,
      options: options(4, { text: pct(ans, 1), why }, wrong.map((w) => ({ text: pct(w, 2), trap: 'lookalike', why: 'Recall the 68–95–99.7 rule and split the tails evenly.' }))),
      tldr: why,
      steps: steps(['Rule', '68% within ±1 SD, 95% within ±2 SD, 99.7% within ±3 SD.'], ['Apply', why]),
      takeaway: 'Memorize 68–95–99.7, and remember each tail outside the band holds half of what’s left.',
    });
  }

  // 2. z-scores
  for (const [mean, sd, score, ask] of [
    [100, 15, 130, 'z'],
    [500, 100, 350, 'z'],
    [70, 8, 86, 'percentile'],
    [50, 10, 40, 'percentile'],
  ]) {
    const z = (score - mean) / sd;
    const pctile = { 2: 0.975, [-1]: 0.16, [-1.5]: 0.07 }[z];
    if (ask === 'z') {
      make({
        type: 'statistics',
        kps: ['kp-mcat-z-scores'],
        outline: { sirs: 4 },
        difficulty: 1,
        prompt: `A test has a mean of ${mean} and a standard deviation of ${sd}. What is the z-score of a student who scored ${score}?`,
        options: options(4, { text: fmt(z), why: `z = (${score} − ${mean})/${sd} = ${fmt(z)}.` }, [
          { text: fmt(-z), trap: 'sign_flip', why: 'Subtract the mean from the score, not the reverse.' },
          { text: fmt(score - mean), trap: 'skipped_step', why: 'That’s the raw difference. Divide by the standard deviation.' },
          { text: fmt((score - mean) / (sd * sd), 3), trap: 'lookalike', why: 'Divide by the standard deviation, not the variance.' },
        ]),
        tldr: `z = (score − mean)/SD = ${fmt(z)}.`,
        steps: steps(['Difference', `${score} − ${mean} = ${score - mean}.`], ['Standardize', `${score - mean}/${sd} = ${fmt(z)}.`]),
        takeaway: 'A z-score counts how many standard deviations a score sits from the mean.',
      });
    } else {
      make({
        type: 'statistics',
        kps: ['kp-mcat-z-scores', 'kp-mcat-normal-distribution'],
        outline: { sirs: 4 },
        difficulty: 2,
        prompt: `Scores are normally distributed with a mean of ${mean} and a standard deviation of ${sd}. A score of ${score} falls at about which percentile?`,
        options: options(4, { text: `${fmt(pctile * 100, 1)}th`, why: `z = ${fmt(z)}, and about ${pct(pctile, 1)} of scores fall below that point.` }, [
          { text: `${fmt((1 - pctile) * 100, 1)}th`, trap: 'wrong_direction', why: 'That’s the share above the score. Percentile counts the share below.' },
          { text: '50th', trap: 'false_fact', why: 'The 50th percentile is the mean itself.' },
          { text: `${fmt(Math.min(99.9, 50 + z * 34), 1)}th`, trap: 'lookalike', why: 'Areas under the normal curve aren’t linear in z beyond 1 SD.' },
          { text: `${fmt(Math.max(0.1, 50 + z * 10), 1)}th`, trap: 'lookalike', why: 'Use the 68–95–99.7 rule rather than shifting 10 points per SD.' },
        ]),
        tldr: `z = ${fmt(z)} → about the ${fmt(pctile * 100, 1)}th percentile.`,
        steps: steps(['z-score', `(${score} − ${mean})/${sd} = ${fmt(z)}.`], ['Area', `About ${pct(pctile, 1)} of a normal distribution lies below z = ${fmt(z)}.`]),
        takeaway: 'z = +1 ≈ 84th percentile, +2 ≈ 97.5th, −1 ≈ 16th, −2 ≈ 2.5th.',
      });
    }
  }

  // 3. Mean, median and skew
  for (const [data, ask] of [
    [[2, 3, 3, 4, 18], 'mean'],
    [[2, 3, 3, 4, 18], 'median'],
    [[5, 7, 7, 9, 10, 12], 'median'],
    [[1, 2, 2, 2, 3, 8], 'mode'],
  ]) {
    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / data.length;
    const mid = sorted.length / 2;
    const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
    const counts = new Map();
    for (const x of data) counts.set(x, (counts.get(x) ?? 0) + 1);
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const values = { mean, median, mode };
    const ans = values[ask];
    make({
      type: 'statistics',
      kps: ['kp-mcat-central-tendency'],
      outline: { sirs: 4 },
      difficulty: 1,
      prompt: `For the data set {${data.join(', ')}}, what is the ${ask}?`,
      options: options(4, { text: fmt(ans, 2), why: ask === 'mean' ? `Sum ${sum} ÷ ${data.length} = ${fmt(mean, 2)}.` : ask === 'median' ? `The middle of the sorted list {${sorted.join(', ')}} is ${fmt(median, 2)}.` : `${mode} appears most often.` }, {
        mean: [
          { text: fmt(median, 2), trap: 'lookalike', why: 'That’s the median (the middle value).' },
          { text: fmt(mode, 2), trap: 'lookalike', why: 'That’s the mode (the most frequent value).' },
          { text: fmt(sum, 2), trap: 'skipped_step', why: 'That’s the sum. Divide by the number of values.' },
          { text: fmt(sorted[sorted.length - 1] - sorted[0], 2), trap: 'lookalike', why: 'That’s the range (largest minus smallest).' },
          { text: fmt(sum / (data.length - 1), 2), trap: 'skipped_step', why: `Divide by all ${data.length} values, not ${data.length - 1}.` },
        ],
        median: [
          { text: fmt(mean, 2), trap: 'lookalike', why: 'That’s the mean (the average).' },
          { text: fmt(mode, 2), trap: 'lookalike', why: 'That’s the mode (the most frequent value).' },
          ...(sorted.length % 2 === 0
            ? [{ text: fmt(sorted[sorted.length / 2], 2), trap: 'skipped_step', why: 'With an even count, the median averages the two middle values.' }]
            : []),
          ...(data.some((x, i) => x !== sorted[i])
            ? [{ text: fmt(data[Math.floor(data.length / 2)], 2), trap: 'skipped_step', why: 'Sort the data before finding the middle.' }]
            : []),
          { text: fmt(sorted[sorted.length - 1] - sorted[0], 2), trap: 'lookalike', why: 'That’s the range (largest minus smallest).' },
          { text: fmt(sorted[Math.floor(sorted.length / 2) + 1], 2), trap: 'skipped_step', why: 'That’s past the middle. Count to the center of the sorted list.' },
          { text: fmt(sorted[sorted.length - 1], 2), trap: 'lookalike', why: 'That’s the largest value, an outlier here.' },
        ],
        mode: [
          { text: fmt(mean, 2), trap: 'lookalike', why: 'That’s the mean (the average).' },
          { text: fmt(median, 2), trap: 'lookalike', why: 'That’s the median (the middle value).' },
          { text: fmt(sorted[sorted.length - 1], 2), trap: 'lookalike', why: 'That’s the largest value, not the most frequent one.' },
          { text: fmt(sorted[sorted.length - 1] - sorted[0], 2), trap: 'lookalike', why: 'That’s the range (largest minus smallest).' },
          { text: fmt(counts.get(mode), 2), trap: 'misread_data', why: 'That’s how many times the mode appears, not the mode itself.' },
        ],
      }[ask]),
      tldr: `${ask[0].toUpperCase() + ask.slice(1)} = ${fmt(ans, 2)}.${ask === 'mean' && mean > median ? ' The outlier pulls the mean above the median.' : ''}`,
      steps: steps(['Sort', `{${sorted.join(', ')}}.`], ['Find', `Mean ${fmt(mean, 2)}, median ${fmt(median, 2)}, mode ${mode}.`]),
      takeaway: 'Outliers drag the mean toward the tail; the median and mode resist them.',
    });
  }
  make({
    type: 'statistics',
    kps: ['kp-mcat-central-tendency'],
    outline: { sirs: 4 },
    difficulty: 2,
    prompt: 'Household incomes in a city are strongly right-skewed. How do the mean and median income compare?',
    options: options(4, { text: 'The mean is greater than the median.', why: 'A few very high incomes stretch the right tail and pull the mean up.' }, [
      { text: 'The median is greater than the mean.', trap: 'wrong_direction', why: 'That pattern goes with left (negative) skew.' },
      { text: 'They are equal.', trap: 'false_fact', why: 'Mean and median match only in symmetric distributions.' },
      { text: 'It can’t be determined from the shape alone.', trap: 'too_weak', why: 'Skew direction tells you which way the mean is pulled.' },
    ]),
    tldr: 'Right skew: mean > median > mode.',
    steps: steps(['Shape', 'Right-skewed means a long tail of high values.'], ['Effect', 'The mean is sensitive to those extremes; the median isn’t.']),
    takeaway: 'The mean follows the tail: right skew puts it above the median, left skew below.',
  });

  // 4. Correlation strength and variance explained
  for (const [values, ask] of [
    [[-0.82, 0.45, 0.7, -0.1], 'strongest'],
    [[0.3, -0.65, 0.6, 0.05], 'strongest'],
    [[0.5], 'variance'],
    [[-0.7], 'variance'],
  ]) {
    if (ask === 'strongest') {
      const best = [...values].sort((a, b) => Math.abs(b) - Math.abs(a))[0];
      make({
        type: 'statistics',
        kps: ['kp-mcat-correlation-strength'],
        outline: { sirs: 4 },
        difficulty: 1,
        prompt: 'Which correlation coefficient shows the strongest linear relationship?',
        options: options(
          4,
          { text: `r = ${fmt(best)}`, why: `Strength is the absolute value: |${fmt(best)}| is the largest.` },
          values
            .filter((v) => v !== best)
            .map((v) => ({ text: `r = ${fmt(v)}`, trap: v > 0 && v > best ? 'lookalike' : 'lookalike', why: `|${fmt(v)}| is smaller. The sign shows direction, not strength.` })),
        ),
        tldr: 'Compare absolute values: the sign only gives the direction.',
        steps: steps(['Ignore sign', `Absolute values: ${values.map((v) => fmt(Math.abs(v))).join(', ')}.`], ['Pick', `The largest is |${fmt(best)}|.`]),
        takeaway: 'Correlation strength is |r|; a strong negative correlation beats a weak positive one.',
      });
    } else {
      const r = values[0];
      make({
        type: 'statistics',
        kps: ['kp-mcat-correlation-strength'],
        outline: { sirs: 4 },
        difficulty: 2,
        prompt: `Two variables have a correlation of r = ${fmt(r)}. What proportion of the variance in one is accounted for by the other?`,
        options: options(4, { text: pct(r * r), why: `r² = (${fmt(r)})² = ${fmt(r * r)} = ${pct(r * r)}.` }, [
          { text: pct(Math.abs(r)), trap: 'skipped_step', why: 'Variance explained is r², not r.' },
          { text: `−${pct(r * r)}`, trap: 'sign_flip', why: 'r² can’t be negative.' },
          { text: pct(1 - r * r), trap: 'wrong_direction', why: 'That’s the variance left unexplained.' },
        ]),
        tldr: `Variance explained = r² = ${pct(r * r)}.`,
        steps: steps(['Square', `(${fmt(r)})² = ${fmt(r * r)}.`], ['Read', `${pct(r * r)} of the variance is shared.`]),
        takeaway: 'Square r to get the variance explained; even r = 0.5 explains only 25%.',
      });
    }
  }

  // 5. Independent events
  for (const [scenario, p1, p2, ask] of [
    ['A couple’s chance of having a girl is ½ for each birth. What is the probability their first two children are both girls?', 0.5, 0.5, 'both'],
    ['Each of two independent screening tests has a 10% false-positive rate. What is the probability that a healthy person gets at least one false positive?', 0.1, 0.1, 'atleast'],
    ['A participant answers two independent true/false questions by guessing. What is the probability of getting both right?', 0.5, 0.5, 'both'],
    ['Two independent events have probabilities 0.3 and 0.4. What is the probability that both occur?', 0.3, 0.4, 'both'],
  ]) {
    const both = p1 * p2;
    const atleast = 1 - (1 - p1) * (1 - p2);
    const ans = ask === 'both' ? both : atleast;
    const show = (x) => (ask === 'both' && p1 === 0.5 ? fraction(x) : pct(x));
    make({
      type: 'statistics',
      kps: ['kp-mcat-probability'],
      outline: { sirs: 4 },
      difficulty: 2,
      prompt: scenario,
      options: options(4, { text: show(ans), why: ask === 'both' ? `Independent events multiply: ${fmt(p1)} × ${fmt(p2)} = ${fmt(both, 3)}.` : `1 − P(no false positives) = 1 − (0.9 × 0.9) = ${fmt(atleast, 3)}.` }, [
        { text: show(p1 + p2), trap: 'lookalike', why: 'Adding probabilities applies to mutually exclusive events, not to “both.”' },
        { text: show(ask === 'both' ? atleast : both), trap: 'lookalike', why: ask === 'both' ? 'That’s the chance of at least one.' : 'That’s the chance of both, not at least one.' },
        { text: show(p1), trap: 'skipped_step', why: 'That counts only one event.' },
        { text: show(1 - ans), trap: 'wrong_direction', why: 'That’s the complement of the event asked about.' },
      ]),
      tldr: ask === 'both' ? `Multiply: ${fmt(p1)} × ${fmt(p2)} = ${fmt(both, 3)}.` : `At least one = 1 − (0.9)² = ${fmt(atleast, 3)}.`,
      steps: steps(['Independence', 'One outcome doesn’t change the other’s probability.'], ['Combine', ask === 'both' ? 'P(A and B) = P(A) × P(B).' : 'P(at least one) = 1 − P(neither).']),
      takeaway: '“Both” means multiply; “at least one” means 1 minus the chance of neither.',
    });
  }

  // 6. Weber’s law
  for (const [base, jnd, test, unit] of [
    [100, 2, 400, 'g'],
    [50, 5, 200, 'lumens'],
    [200, 10, 600, 'g'],
    [40, 4, 160, 'lumens'],
  ]) {
    const k = jnd / base;
    const ans = k * test;
    make({
      type: 'sensation_perception',
      kps: ['kp-mcat-weber'],
      outline: { category: '6A', sirs: 2 },
      difficulty: 2,
      prompt: `A person can just detect a change from ${base} ${unit} to ${base + jnd} ${unit}. By Weber’s law, what is the smallest detectable change from ${test} ${unit}?`,
      options: options(4, { text: `${fmt(ans, 1)} ${unit}`, why: `Weber fraction = ${jnd}/${base} = ${fmt(k, 3)}; ${fmt(k, 3)} × ${test} = ${fmt(ans, 1)} ${unit}.` }, [
        { text: `${fmt(jnd, 1)} ${unit}`, trap: 'lookalike', why: 'The JND isn’t a fixed amount; it’s a fixed fraction of the stimulus.' },
        { text: `${fmt((jnd * base) / test, 2)} ${unit}`, trap: 'wrong_direction', why: 'That inverts the scaling. Bigger stimuli need bigger changes.' },
        { text: `${fmt(jnd + (test - base), 1)} ${unit}`, trap: 'lookalike', why: 'Weber’s law is proportional, not additive.' },
      ]),
      tldr: `JND = k × stimulus: ${fmt(k, 3)} × ${test} = ${fmt(ans, 1)} ${unit}.`,
      steps: steps(['Weber fraction', `k = ΔI/I = ${jnd}/${base} = ${fmt(k, 3)}.`], ['Scale', `${fmt(k, 3)} × ${test} = ${fmt(ans, 1)}.`]),
      takeaway: 'The just-noticeable difference grows in proportion to the baseline stimulus.',
    });
  }

  // 7. Demographic rates
  for (const [kind, a, b] of [
    ['birth', 15000, 1000000],
    ['death', 4200, 600000],
    ['doubling', 2, null],
    ['doubling', 3.5, null],
    ['doubling', 7, null],
  ]) {
    if (kind === 'doubling') {
      const years = 70 / a;
      make({
        type: 'demographics',
        kps: ['kp-mcat-demographic-rates'],
        outline: { category: '9B', sirs: 2 },
        difficulty: 2,
        prompt: `A population grows at a steady ${fmt(a, 1)}% per year. About how long will it take to double?`,
        options: options(4, { text: `${fmt(years, 0)} years`, why: `Rule of 70: 70 ÷ ${fmt(a, 1)} ≈ ${fmt(years, 0)} years.` }, [
          { text: `${fmt(100 / a, 0)} years`, trap: 'lookalike', why: 'That ignores compounding (100 ÷ rate). Growth compounds, so doubling comes sooner.' },
          { text: `${fmt(50 / a, 0)} years`, trap: 'lookalike', why: 'The rule of thumb uses 70 (≈ 100 × ln 2), not 50.' },
          { text: `${fmt(70 * a, 0)} years`, trap: 'wrong_direction', why: 'Divide 70 by the rate; faster growth means a shorter doubling time.' },
        ]),
        tldr: `Doubling time ≈ 70 ÷ ${fmt(a, 1)}% ≈ ${fmt(years, 0)} years.`,
        steps: steps(['Rule of 70', 'Doubling time (years) ≈ 70 ÷ annual growth rate in percent.'], ['Compute', `70 ÷ ${fmt(a, 1)} ≈ ${fmt(years, 0)}.`]),
        takeaway: 'Rule of 70: doubling time ≈ 70 ÷ percent growth per year.',
      });
    } else {
      const rate = (a / b) * 1000;
      make({
        type: 'demographics',
        kps: ['kp-mcat-demographic-rates'],
        outline: { category: '9B', sirs: 2 },
        difficulty: 1,
        prompt: `A city of ${b.toLocaleString('en-US')} people records ${a.toLocaleString('en-US')} ${kind === 'birth' ? 'births' : 'deaths'} in a year. What is its crude ${kind} rate?`,
        options: options(4, { text: `${fmt(rate, 1)} per 1,000`, why: `${a.toLocaleString('en-US')} ÷ ${b.toLocaleString('en-US')} × 1,000 = ${fmt(rate, 1)}.` }, [
          { text: `${fmt(rate / 10, 2)} per 1,000`, trap: 'lookalike', why: 'That’s a percentage. Crude rates are per 1,000 people.' },
          { text: `${fmt(rate * 10, 0)} per 1,000`, trap: 'power_of_ten', why: 'That’s per 10,000. Crude rates use 1,000.' },
          { text: `${fmt((b / a), 1)} per 1,000`, trap: 'wrong_direction', why: 'That inverts the ratio.' },
        ]),
        tldr: `Crude ${kind} rate = ${kind === 'birth' ? 'births' : 'deaths'}/population × 1,000 = ${fmt(rate, 1)}.`,
        steps: steps(['Ratio', `${a.toLocaleString('en-US')}/${b.toLocaleString('en-US')} = ${fmt(a / b, 4)}.`], ['Scale', `× 1,000 = ${fmt(rate, 1)} per 1,000.`]),
        takeaway: 'Crude birth and death rates are counted per 1,000 people per year.',
      });
    }
  }
}
