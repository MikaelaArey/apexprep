// Bio/Biochem item models: genetics ratios, enzyme kinetics, pI, Nernst
// potentials and physiology arithmetic. Answers are computed here.

import { fixed, fmt, fraction, options, pct, steps } from './helpers.mjs';

export const knowledgePoints = [
  ['kp-mcat-mendelian-ratios', 'Mendelian ratios', 'Aa × Aa: what fraction of offspring are aa? What fraction of the dominant-looking offspring are carriers?', '¼ are aa. Among dominant-phenotype offspring (AA, Aa, Aa), ⅔ are carriers.'],
  ['kp-mcat-x-linked', 'X-linked inheritance', 'A carrier mother and an unaffected father have a son. What’s the chance he’s affected by an X-linked recessive trait?', '½. Sons get their only X from their mother; daughters of an unaffected father aren’t affected.'],
  ['kp-mcat-michaelis-menten', 'Michaelis–Menten', 'What is V₀ when [S] = Km? When [S] = 3Km?', 'V₀ = Vmax[S]/(Km + [S]): ½Vmax at [S] = Km, ¾Vmax at 3Km, 9/10 Vmax at 9Km.'],
  ['kp-mcat-lineweaver-burk', 'Lineweaver–Burk plots', 'What do the intercepts of a Lineweaver–Burk plot give?', 'y-intercept = 1/Vmax; x-intercept = −1/Km; slope = Km/Vmax.'],
  ['kp-mcat-isoelectric-point', 'Isoelectric point', 'How do you find an amino acid’s pI?', 'Average the two pKa values on either side of the neutral form: the two lowest for acidic side chains, the two highest for basic ones.'],
  ['kp-mcat-nernst', 'Nernst equation', 'How do you estimate an ion’s equilibrium potential at body temperature?', 'E = (61.5 mV / z) × log([out]/[in]). K⁺ is about −90 mV; Na⁺ about +60 mV.'],
  ['kp-mcat-cardiac-output', 'Cardiac output', 'How are cardiac output, stroke volume and ejection fraction calculated?', 'SV = EDV − ESV; CO = HR × SV; EF = SV/EDV.'],
  ['kp-mcat-ventilation', 'Ventilation', 'What’s the difference between minute and alveolar ventilation?', 'Minute ventilation = tidal volume × rate. Alveolar ventilation subtracts dead space: (VT − VD) × rate.'],
  ['kp-mcat-chargaff', 'Chargaff’s rules', 'In double-stranded DNA that is 20% adenine, what fraction is guanine?', 'A = T and G = C, so A + T = 40% and G = C = 30% each.'],
];

export function build(make) {
  // 1. Hardy–Weinberg
  for (const [rec, ask] of [
    [0.04, 'carriers'],
    [0.09, 'carriers'],
    [0.49, 'homdom'],
    [0.01, 'carriers'],
    [0.36, 'p'],
    [0.16, 'homdom'],
  ]) {
    const q = Math.sqrt(rec);
    const p = 1 - q;
    const answers = { carriers: 2 * p * q, homdom: p * p, p };
    const ans = answers[ask];
    const label = ask === 'p' ? (x) => fmt(x, 2) : (x) => pct(x, 2);
    const askText = {
      carriers: 'What percentage of the population is heterozygous?',
      homdom: 'What percentage of the population is homozygous dominant?',
      p: 'What is the frequency of the dominant allele?',
    }[ask];
    make({
      type: 'genetics',
      kps: ['kp-mcat-hardy-weinberg'],
      outline: { category: '1C', sirs: 2 },
      difficulty: 2,
      prompt: `In a population in Hardy–Weinberg equilibrium, ${pct(rec, 2)} of individuals show a recessive phenotype. ${askText}`,
      options: options(
        4,
        { text: label(ans), why: `q = √${fmt(rec)} = ${fmt(q)}, p = ${fmt(p)}; ${ask === 'carriers' ? `2pq = ${fmt(2 * p * q, 4)}` : ask === 'homdom' ? `p² = ${fmt(p * p, 4)}` : `p = ${fmt(p)}`}.` },
        ask === 'p'
          ? [
              { text: label(q), trap: 'lookalike', why: 'That’s q, the recessive allele frequency.' },
              { text: label(rec), trap: 'lookalike', why: 'That’s q², a genotype frequency, not an allele frequency.' },
              { text: label(p * p), trap: 'lookalike', why: 'That’s p², the homozygous dominant genotype frequency.' },
              { text: label(2 * p * q), trap: 'lookalike', why: 'That’s 2pq, the heterozygote frequency.' },
            ]
          : [
              { text: label(rec), trap: 'lookalike', why: 'That’s q², the recessive phenotype frequency itself.' },
              { text: label(p * q), trap: 'skipped_step', why: 'Heterozygotes are 2pq, not pq.' },
              { text: label(2 * p * q), trap: 'lookalike', why: 'That’s 2pq, the heterozygote frequency.' },
              { text: label(p * p), trap: 'lookalike', why: 'That’s p², the homozygous dominant frequency.' },
              { text: label(1 - rec), trap: 'lookalike', why: 'That’s everyone with the dominant phenotype (p² + 2pq).' },
              { text: label(p), trap: 'lookalike', why: 'That’s p, an allele frequency, not a genotype frequency.' },
            ],
      ),
      tldr: `q² = ${fmt(rec)} → q = ${fmt(q)}, p = ${fmt(p)}; ${ask === 'carriers' ? `2pq = ${pct(2 * p * q, 2)}` : ask === 'homdom' ? `p² = ${pct(p * p, 2)}` : `p = ${fmt(p)}`}.`,
      steps: steps(
        ['Find q', `The recessive phenotype is q² = ${fmt(rec)}, so q = ${fmt(q)}.`],
        ['Find p', `p = 1 − q = ${fmt(p)}.`],
        ['Answer', ask === 'carriers' ? `2pq = 2 × ${fmt(p)} × ${fmt(q)} = ${fmt(2 * p * q, 4)}.` : ask === 'homdom' ? `p² = ${fmt(p)}² = ${fmt(p * p, 4)}.` : `The dominant allele frequency is p = ${fmt(p)}.`],
      ),
      takeaway: 'Start Hardy–Weinberg problems from q² (the recessive phenotype); take its square root to get q.',
    });
  }

  // 2. Mendelian crosses
  const crosses = [
    ['Aa × Aa', 'offspring will be homozygous recessive (aa)', 1 / 4, 'Punnett square: AA, Aa, Aa, aa, so ¼ are aa.', [3 / 4, 1 / 2, 1 / 16]],
    ['Aa × aa', 'offspring will show the recessive phenotype', 1 / 2, 'Half the gametes from Aa carry a; every gamete from aa does: Aa or aa, ½ each.', [1 / 4, 3 / 4, 1]],
    ['Aa × Aa', 'offspring with the dominant phenotype are heterozygous', 2 / 3, 'Dominant-phenotype offspring are AA, Aa, Aa: 2 of 3 are Aa.', [1 / 2, 3 / 4, 1 / 4]],
    ['AaBb × AaBb', 'offspring will be aabb', 1 / 16, '¼ (aa) × ¼ (bb) = 1/16, assuming independent assortment.', [1 / 4, 1 / 8, 9 / 16]],
    ['AaBb × AaBb', 'offspring will show both dominant phenotypes (A_B_)', 9 / 16, '¾ × ¾ = 9/16.', [3 / 4, 3 / 16, 1 / 2]],
    ['AaBb × aabb', 'offspring will be aabb', 1 / 4, '½ (aa) × ½ (bb) = ¼.', [1 / 16, 1 / 2, 1 / 8]],
  ];
  for (const [cross, ask, p, why, wrong] of crosses) {
    const wrongWhy = {
      [String(1 / 16)]: 'That’s the dihybrid AaBb × AaBb fraction for one class.',
      [String(9 / 16)]: 'That’s the A_B_ fraction in a dihybrid cross.',
    };
    make({
      type: 'genetics',
      kps: ['kp-mcat-mendelian-ratios'],
      outline: { category: '1C', sirs: 2 },
      difficulty: cross.includes('B') || ask.includes('heterozygous') ? 3 : 1,
      prompt: `For the cross ${cross}, with complete dominance and independent assortment, what fraction of ${ask}?`,
      options: options(
        4,
        { text: fraction(p), why },
        wrong.map((w) => ({ text: fraction(w), trap: 'skipped_step', why: wrongWhy[String(w)] ?? 'Recount the Punnett square for this cross, one gene at a time.' })),
      ),
      tldr: why,
      steps: steps(['Split the genes', 'Work each gene separately with a 2 × 2 Punnett square.'], ['Combine', 'Multiply the probabilities for independent genes.']),
      takeaway: 'Break multi-gene crosses into single-gene crosses and multiply: ¼, ½ and ¾ are the building blocks.',
    });
  }

  // 3. X-linked recessive
  for (const [parents, ask, p, why, wrong] of [
    ['a carrier mother and an unaffected father', 'that a son is affected', 1 / 2, 'Sons inherit their single X from their mother, who passes the affected X half the time.', [1 / 4, 0, 1]],
    ['a carrier mother and an unaffected father', 'that a child (sex unknown) is affected', 1 / 4, '½ chance of a son × ½ chance he gets the affected X = ¼.', [1 / 2, 1 / 8, 0]],
    ['a carrier mother and an unaffected father', 'that a daughter is affected', 0, 'Daughters get the father’s normal X, so they can be carriers but not affected.', [1 / 2, 1 / 4, 1]],
    ['an affected father and a non-carrier mother', 'that a daughter is a carrier', 1, 'Every daughter receives the father’s only X, which carries the allele.', [1 / 2, 1 / 4, 0]],
    ['an affected father and a non-carrier mother', 'that a son is affected', 0, 'Sons receive the father’s Y, not his X, and the mother has only normal alleles.', [1 / 2, 1, 1 / 4]],
  ]) {
    make({
      type: 'genetics',
      kps: ['kp-mcat-x-linked'],
      outline: { category: '1C', sirs: 2 },
      difficulty: 2,
      prompt: `An X-linked recessive disorder runs in a family. For ${parents}, what is the probability ${ask}?`,
      options: options(
        4,
        { text: fraction(p), why },
        wrong.map((w) => ({ text: fraction(w), trap: w === 0 || w === 1 ? 'false_fact' : 'skipped_step', why: 'Track which X chromosome each child gets: sons get the mother’s X, daughters get one from each parent.' })),
      ),
      tldr: why,
      steps: steps(['Sons', 'Get their X from the mother and their Y from the father.'], ['Daughters', 'Get one X from each parent.']),
      takeaway: 'X-linked recessive: affected fathers have all carrier daughters and no affected sons; carrier mothers give each son a ½ chance.',
    });
  }

  // 4. Michaelis–Menten
  for (const [vmax, km, s] of [
    [100, 2, 4],
    [100, 2, 6],
    [80, 1, 9],
    [60, 5, 15],
    [200, 4, 1],
  ]) {
    const v = (vmax * s) / (km + s);
    make({
      type: 'enzyme_kinetics',
      kps: ['kp-mcat-michaelis-menten'],
      outline: { category: '1A', sirs: 2 },
      difficulty: 2,
      prompt: `An enzyme has Vmax = ${vmax} µM/min and Km = ${km} mM. What is the initial velocity when [S] = ${s} mM?`,
      options: options(4, { text: `${fmt(v, 1)} µM/min`, why: `V₀ = Vmax[S]/(Km + [S]) = ${vmax} × ${s}/(${km} + ${s}) = ${fmt(v, 1)} µM/min.` }, [
        { text: `${fmt(vmax / 2, 1)} µM/min`, trap: 'lookalike', why: 'Vmax/2 applies only when [S] = Km.' },
        { text: `${fmt(vmax, 1)} µM/min`, trap: 'lookalike', why: 'Vmax is approached only when [S] is far above Km.' },
        { text: `${fmt((vmax * km) / (km + s), 1)} µM/min`, trap: 'wrong_direction', why: 'That puts Km in the numerator. V₀ = Vmax[S]/(Km + [S]).' },
        { text: `${fmt((vmax * s) / km, 1)} µM/min`, trap: 'skipped_step', why: 'That leaves [S] out of the denominator.' },
        { text: `${fmt(v / 2, 1)} µM/min`, trap: 'skipped_step', why: 'Recheck the arithmetic in Vmax[S]/(Km + [S]).' },
      ]),
      tldr: `V₀ = ${vmax} × ${s}/(${km} + ${s}) = ${fmt(v, 1)} µM/min.`,
      steps: steps(['Equation', 'V₀ = Vmax[S]/(Km + [S]).'], ['Plug in', `${vmax} × ${s}/${km + s} = ${fmt(v, 1)} µM/min (${fmt((100 * s) / (km + s), 1)}% of Vmax).`]),
      takeaway: '[S] = Km gives ½Vmax, 3Km gives ¾Vmax, 9Km gives 9/10 Vmax.',
    });
  }

  // 5. Lineweaver–Burk intercepts
  for (const [ask, value] of [
    ['vmax', 0.025],
    ['vmax', 0.05],
    ['km', -0.25],
    ['km', -0.5],
  ]) {
    const isV = ask === 'vmax';
    const ans = isV ? 1 / value : -1 / value;
    const unit = isV ? 'µM/min' : 'mM';
    make({
      type: 'enzyme_kinetics',
      kps: ['kp-mcat-lineweaver-burk'],
      outline: { category: '1A', sirs: 4 },
      difficulty: 2,
      prompt: isV
        ? `On a Lineweaver–Burk plot for an enzyme, the line crosses the y-axis at ${fmt(value, 3)} min/µM. What is Vmax?`
        : `On a Lineweaver–Burk plot for an enzyme, the line crosses the x-axis at ${fmt(value, 2)} mM⁻¹. What is Km?`,
      options: options(4, { text: `${fmt(ans)} ${unit}`, why: isV ? `y-intercept = 1/Vmax, so Vmax = 1/${fmt(value, 3)} = ${fmt(ans)} µM/min.` : `x-intercept = −1/Km, so Km = −1/(${fmt(value, 2)}) = ${fmt(ans)} mM.` }, [
        { text: `${fmt(Math.abs(value), 3)} ${unit}`, trap: 'skipped_step', why: 'That’s the intercept itself. Take its reciprocal.' },
        { text: `${fmt(-ans)} ${unit}`, trap: 'sign_flip', why: isV ? 'Vmax is positive.' : 'Km is positive; the x-intercept is −1/Km.' },
        { text: `${fmt(ans / 2)} ${unit}`, trap: 'lookalike', why: isV ? 'Half of Vmax is the rate at [S] = Km, not Vmax.' : 'Recheck: Km = −1/(x-intercept).' },
      ]),
      tldr: isV ? `Vmax = 1/(y-intercept) = ${fmt(ans)} µM/min.` : `Km = −1/(x-intercept) = ${fmt(ans)} mM.`,
      steps: steps(['Recall', '1/V₀ = (Km/Vmax)(1/[S]) + 1/Vmax.'], ['Intercept', isV ? 'At 1/[S] = 0, 1/V₀ = 1/Vmax.' : 'At 1/V₀ = 0, 1/[S] = −1/Km.']),
      takeaway: 'Lineweaver–Burk: y-intercept 1/Vmax, x-intercept −1/Km, slope Km/Vmax.',
    });
  }

  // 6. Isoelectric points
  for (const [name, pkas, kind] of [
    ['glycine', [2.34, 9.6], 'neutral'],
    ['alanine', [2.34, 9.69], 'neutral'],
    ['aspartate', [1.88, 3.65, 9.6], 'acidic'],
    ['glutamate', [2.19, 4.25, 9.67], 'acidic'],
    ['lysine', [2.18, 8.95, 10.53], 'basic'],
  ]) {
    const pair = kind === 'basic' ? [pkas[1], pkas[2]] : [pkas[0], pkas[1]];
    const pi = (pair[0] + pair[1]) / 2;
    const all = pkas.reduce((a, b) => a + b, 0) / pkas.length;
    const wrongPair = kind === 'basic' ? (pkas[0] + pkas[1]) / 2 : kind === 'acidic' ? (pkas[1] + pkas[2]) / 2 : (pkas[0] + pkas[1]) / 2 + 1;
    make({
      type: 'amino_acids',
      kps: ['kp-mcat-isoelectric-point'],
      outline: { category: '1A', sirs: 2 },
      difficulty: kind === 'neutral' ? 1 : 3,
      prompt: `${name[0].toUpperCase() + name.slice(1)} has pKa values of ${pkas.map((x) => fixed(x, 2)).join(', ')}. What is its isoelectric point (pI)?`,
      options: options(4, { text: fixed(pi, 2), why: `Average the two pKas around the neutral form: (${fixed(pair[0], 2)} + ${fixed(pair[1], 2)})/2 = ${fixed(pi, 2)}.` }, [
        { text: fixed(all, 2), trap: 'lookalike', why: 'Averaging every pKa gives the wrong answer when there are three.' },
        { text: fixed(wrongPair, 2), trap: 'misread_data', why: kind === 'basic' ? 'For a basic amino acid, use the two highest pKas.' : kind === 'acidic' ? 'For an acidic amino acid, use the two lowest pKas.' : 'pI is the average of the two pKas.' },
        { text: fixed(pkas[pkas.length - 1], 2), trap: 'lookalike', why: 'A single pKa isn’t the pI; the pI sits between two of them.' },
        { text: '7.00', trap: 'false_fact', why: 'pI depends on the side chain; it isn’t automatically neutral pH.' },
      ]),
      tldr: `pI = average of the two pKas bracketing the zwitterion = ${fixed(pi, 2)}.`,
      steps: steps(
        ['Classify', kind === 'neutral' ? 'Two ionizable groups: average them.' : kind === 'acidic' ? 'Acidic side chain: average the two lowest pKas.' : 'Basic side chain: average the two highest pKas.'],
        ['Compute', `(${fixed(pair[0], 2)} + ${fixed(pair[1], 2)})/2 = ${fixed(pi, 2)}.`],
      ),
      takeaway: 'pI = mean of the two pKas around the net-neutral form: lowest pair for acidic, highest pair for basic.',
    });
  }

  // 7. Nernst equilibrium potentials (37 °C)
  for (const [ion, z, out, inside] of [
    ['K⁺', 1, 5, 150],
    ['Na⁺', 1, 145, 15],
    ['Ca²⁺', 2, 2, 0.0002],
    ['Cl⁻', -1, 110, 10],
  ]) {
    const e = (61.5 / z) * Math.log10(out / inside);
    const mv = (x) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), 0)} mV`;
    make({
      type: 'nervous_system',
      kps: ['kp-mcat-nernst'],
      outline: { category: '3A', sirs: 2 },
      difficulty: 3,
      prompt: `At 37 °C, ${ion} is ${fmt(out, 4)} mM outside a cell and ${fmt(inside, 4)} mM inside. Using E = (61.5/z) log([out]/[in]) mV, what is the equilibrium potential for ${ion}?`,
      options: options(4, { text: mv(e), why: `(61.5/${z}) × log(${fmt(out / inside, 4)}) = ${mv(e)}.` }, [
        { text: mv(-e), trap: 'sign_flip', why: 'That uses [in]/[out]. The Nernst equation puts [out] on top.' },
        { text: mv(61.5 * Math.log10(out / inside)), trap: 'skipped_step', why: `Divide by the ion’s charge (z = ${z}).` },
        { text: mv(-61.5 * Math.log10(out / inside)), trap: 'sign_flip', why: 'Check both the ratio and the charge’s sign.' },
        { text: mv(e / 2), trap: 'skipped_step', why: 'Recheck the logarithm of the concentration ratio.' },
        { text: mv(e * 2), trap: 'skipped_step', why: 'Recheck the logarithm of the concentration ratio.' },
        { text: '0 mV', trap: 'false_fact', why: 'There’s a concentration gradient, so the equilibrium potential isn’t zero.' },
      ]),
      tldr: `E = (61.5/${z}) × log(${fmt(out, 4)}/${fmt(inside, 4)}) ≈ ${mv(e)}.`,
      steps: steps(['Ratio', `[out]/[in] = ${fmt(out / inside, 4)}; log = ${fmt(Math.log10(out / inside), 3)}.`], ['Charge', `Multiply by 61.5/${z}: ${mv(e)}.`]),
      takeaway: 'Ions concentrated outside with positive charge give positive potentials (Na⁺, Ca²⁺); K⁺, concentrated inside, gives a negative one.',
    });
  }

  // 8. Cardiac output
  for (const [hr, edv, esv, ask] of [
    [70, 120, 50, 'co'],
    [60, 130, 50, 'co'],
    [80, 100, 40, 'ef'],
    [75, 160, 60, 'ef'],
  ]) {
    const sv = edv - esv;
    const co = (hr * sv) / 1000;
    const ef = sv / edv;
    make({
      type: 'cardio_resp',
      kps: ['kp-mcat-cardiac-output'],
      outline: { category: '3B', sirs: 2 },
      difficulty: 2,
      prompt: `A patient has a heart rate of ${hr} beats/min, an end-diastolic volume of ${edv} mL and an end-systolic volume of ${esv} mL. What is the ${ask === 'co' ? 'cardiac output' : 'ejection fraction'}?`,
      options:
        ask === 'co'
          ? options(4, { text: `${fmt(co, 2)} L/min`, why: `SV = ${edv} − ${esv} = ${sv} mL; CO = ${hr} × ${sv} mL = ${fmt(co, 2)} L/min.` }, [
              { text: `${fmt((hr * edv) / 1000, 2)} L/min`, trap: 'misread_data', why: 'That uses end-diastolic volume as the stroke volume. SV = EDV − ESV.' },
              { text: `${fmt((hr * esv) / 1000, 2)} L/min`, trap: 'misread_data', why: 'That uses end-systolic volume. SV = EDV − ESV.' },
              { text: `${fmt(co * 10, 1)} L/min`, trap: 'power_of_ten', why: 'Convert mL to L: divide by 1000.' },
            ])
          : options(4, { text: pct(ef), why: `SV = ${sv} mL; EF = ${sv}/${edv} = ${pct(ef)}.` }, [
              { text: pct(esv / edv), trap: 'lookalike', why: 'That’s the fraction left in the ventricle (ESV/EDV).' },
              { text: pct(sv / esv), trap: 'misread_data', why: 'EF divides stroke volume by end-diastolic volume, not end-systolic.' },
              { text: pct((sv * hr) / 10000), trap: 'lookalike', why: 'Heart rate doesn’t enter the ejection fraction.' },
            ]),
      tldr: ask === 'co' ? `SV = ${sv} mL; CO = HR × SV = ${fmt(co, 2)} L/min.` : `EF = SV/EDV = ${sv}/${edv} = ${pct(ef)}.`,
      steps: steps(['Stroke volume', `SV = EDV − ESV = ${edv} − ${esv} = ${sv} mL.`], ask === 'co' ? ['Output', `CO = ${hr} × ${sv} = ${hr * sv} mL/min = ${fmt(co, 2)} L/min.`] : ['Fraction', `EF = ${sv}/${edv} = ${pct(ef)}.`]),
      takeaway: 'SV = EDV − ESV, CO = HR × SV, EF = SV/EDV (normal about 55–70%).',
    });
  }

  // 9. Ventilation
  for (const [vt, rr, vd, ask] of [
    [500, 12, 150, 'minute'],
    [500, 12, 150, 'alveolar'],
    [400, 20, 150, 'alveolar'],
    [600, 10, 150, 'minute'],
  ]) {
    const minute = (vt * rr) / 1000;
    const alv = ((vt - vd) * rr) / 1000;
    const ans = ask === 'minute' ? minute : alv;
    make({
      type: 'cardio_resp',
      kps: ['kp-mcat-ventilation'],
      outline: { category: '3B', sirs: 2 },
      difficulty: 2,
      prompt: `A person breathes ${rr} times per minute with a tidal volume of ${vt} mL; anatomical dead space is ${vd} mL. What is their ${ask === 'minute' ? 'minute ventilation' : 'alveolar ventilation'}?`,
      options: options(4, { text: `${fmt(ans, 2)} L/min`, why: ask === 'minute' ? `${vt} mL × ${rr}/min = ${fmt(minute, 2)} L/min.` : `(${vt} − ${vd}) mL × ${rr}/min = ${fmt(alv, 2)} L/min.` }, [
        { text: `${fmt(ask === 'minute' ? alv : minute, 2)} L/min`, trap: 'lookalike', why: ask === 'minute' ? 'That subtracts dead space, which gives alveolar ventilation.' : 'That’s minute ventilation. Alveolar ventilation subtracts dead space.' },
        { text: `${fmt((vd * rr) / 1000, 2)} L/min`, trap: 'misread_data', why: 'That’s the dead-space ventilation.' },
        { text: `${fmt(ans * 10, 1)} L/min`, trap: 'power_of_ten', why: 'Convert mL to L: divide by 1000.' },
      ]),
      tldr: ask === 'minute' ? `VE = VT × RR = ${fmt(minute, 2)} L/min.` : `VA = (VT − VD) × RR = ${fmt(alv, 2)} L/min.`,
      steps: steps(['Formula', ask === 'minute' ? 'Minute ventilation = tidal volume × rate.' : 'Alveolar ventilation = (tidal volume − dead space) × rate.'], ['Compute', `${fmt(ans * 1000)} mL/min = ${fmt(ans, 2)} L/min.`]),
      takeaway: 'Dead space air never reaches the alveoli, so fast, shallow breathing wastes a bigger share of each breath.',
    });
  }

  // 10. Chargaff’s rules
  for (const [base, value, ask] of [
    ['adenine', 0.2, 'guanine'],
    ['guanine', 0.35, 'thymine'],
    ['thymine', 0.3, 'cytosine'],
    ['cytosine', 0.15, 'adenine'],
  ]) {
    const pairOf = { adenine: 'thymine', thymine: 'adenine', guanine: 'cytosine', cytosine: 'guanine' };
    const sameClass = pairOf[base] === ask;
    const ans = sameClass ? value : (1 - 2 * value) / 2;
    make({
      type: 'molecular_biology',
      kps: ['kp-mcat-chargaff'],
      outline: { category: '1B', sirs: 2 },
      difficulty: 1,
      prompt: `A sample of double-stranded DNA is ${pct(value)} ${base}. What percentage is ${ask}?`,
      options: options(4, { text: pct(ans), why: `${base} pairs with ${pairOf[base]} (${pct(value)} each), leaving ${pct(1 - 2 * value)} split evenly between the other two bases.` }, [
        { text: pct(value), trap: 'lookalike', why: `${ask} isn’t ${base}’s partner, so it doesn’t equal ${pct(value)}.` },
        { text: pct(1 - value), trap: 'skipped_step', why: `Subtract both ${base} and its partner ${pairOf[base]} before splitting.` },
        { text: pct(1 - 2 * value), trap: 'skipped_step', why: 'That’s the two remaining bases together. Split it in half.' },
        { text: pct((1 - value) / 3), trap: 'lookalike', why: 'The other bases aren’t equal thirds: A = T and G = C.' },
      ]),
      tldr: `A = T and G = C: ${pct(value)} ${base} means ${pct(value)} ${pairOf[base]}, and ${pct((1 - 2 * value) / 2)} each of the others.`,
      steps: steps(['Pair', `${base} = ${pairOf[base]} = ${pct(value)}.`], ['Split', `The remaining ${pct(1 - 2 * value)} is shared equally: ${pct((1 - 2 * value) / 2)} each.`]),
      takeaway: 'In double-stranded DNA, A = T and G = C, so the four percentages come in matching pairs.',
    });
  }
}
