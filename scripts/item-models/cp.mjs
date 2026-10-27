// Chem/Phys item models. Every answer is computed here; every wrong option comes
// from a named, common mistake, so its rationale is always true.

import { fixed, fmt, options, steps } from './helpers.mjs';

const log10 = Math.log10;

export const knowledgePoints = [
  ['kp-mcat-strong-acid-ph', 'Strong acid and base pH', 'What is the pH of 0.001 M HCl? Of 0.001 M NaOH?', 'Strong acids dissociate fully, so pH = −log[H⁺] = 3. For strong bases, pOH = −log[OH⁻] = 3 and pH = 14 − 3 = 11 (at 25 °C).'],
  ['kp-mcat-dilution', 'Dilution', 'How do you find a concentration after dilution?', 'M₁V₁ = M₂V₂, where V₂ is the final total volume. Dilution always lowers concentration.'],
  ['kp-mcat-molar-volume', 'Molar volume at STP', 'What volume does one mole of ideal gas occupy at STP (0 °C, 1 atm)?', '22.4 L. Moles = volume ÷ 22.4 L/mol at STP.'],
  ['kp-mcat-combined-gas', 'Combined gas law', 'How does an ideal gas’s volume respond to pressure and temperature?', 'PV/T is constant, so V ∝ T/P: volume rises with kelvin temperature and falls with pressure.'],
  ['kp-mcat-electric-power', 'Electric power', 'What power does a resistor dissipate?', 'P = IV = I²R = V²/R. At fixed resistance, doubling the voltage quadruples the power.'],
  ['kp-mcat-capacitors', 'Capacitors', 'How much charge and energy does a charged capacitor store?', 'Q = CV and U = ½CV² (= ½QV).'],
  ['kp-mcat-coulomb', 'Coulomb’s law', 'How does the electric force between two charges scale?', 'F = kq₁q₂/r²: proportional to each charge, inversely proportional to the square of the distance.'],
  ['kp-mcat-projectile', 'Horizontal launches', 'A ball rolls off a ledge horizontally. What sets its flight time?', 'Only the height: t = √(2h/g). Horizontal distance = horizontal speed × t.'],
  ['kp-mcat-kinetic-energy', 'Kinetic energy', 'How does kinetic energy scale with speed and mass, and how fast is an object after falling h?', 'KE = ½mv², so it scales with v². Energy conservation gives v = √(2gh), independent of mass.'],
  ['kp-mcat-work-power', 'Work and power', 'How do you find the average power of a force?', 'Work W = Fd (force along the motion; lifting: mgh). Power P = W/t.'],
  ['kp-mcat-hydrostatic', 'Pressure at depth', 'What is the pressure at a depth h in a fluid?', 'Gauge pressure = ρgh. Absolute pressure adds the surface pressure (about 1 atm ≈ 100 kPa).'],
  ['kp-mcat-buoyancy', 'Floating objects', 'What fraction of a floating object is submerged?', 'Its density divided by the fluid’s density (ρ_object/ρ_fluid).'],
  ['kp-mcat-magnification', 'Magnification', 'How do you read magnification for a lens or mirror?', 'm = −dᵢ/dₒ. Negative means inverted, |m| < 1 means smaller than the object.'],
  ['kp-mcat-lens-power', 'Lens power', 'What is a lens’s power in diopters?', 'P = 1/f with f in meters. Converging lenses are positive, diverging lenses negative.'],
  ['kp-mcat-decibels', 'Sound level', 'How do decibels relate to intensity?', 'β = 10 log(I/I₀): every 10× in intensity adds 10 dB.'],
  ['kp-mcat-half-life', 'Half-life', 'How much of a radioactive sample remains after n half-lives?', '(½)ⁿ of the original. Three half-lives leave one-eighth.'],
  ['kp-mcat-cell-potential', 'Standard cell potential', 'How do you get E°cell from standard reduction potentials?', 'E°cell = E°(cathode) − E°(anode), both as reduction potentials. Never multiply by stoichiometric coefficients.'],
  ['kp-mcat-rate-law', 'Rate laws', 'Rate = k[A]²[B]. What happens if [A] doubles?', 'The rate changes by 2² = 4×. Each concentration factor is raised to its order.'],
  ['kp-mcat-moles', 'Moles from mass', 'How do you convert grams to moles?', 'Moles = mass ÷ molar mass (g/mol).'],
  ['kp-mcat-oscillation', 'Periods of oscillation', 'How do a pendulum’s and a spring’s periods depend on their properties?', 'Pendulum: T = 2π√(L/g), independent of mass. Spring: T = 2π√(m/k).'],
];

export function build(make) {
  // 1. Henderson–Hasselbalch
  const buffers = [
    ['acetic acid', 'sodium acetate', 'acetate', 'acetic acid', 4.76, 10, 'ten times'],
    ['formic acid', 'sodium formate', 'formate', 'formic acid', 3.75, 0.1, 'one-tenth of'],
    ['ammonium chloride (NH₄⁺)', 'ammonia (NH₃)', 'ammonia', 'ammonium', 9.25, 100, '100 times'],
    ['sodium dihydrogen phosphate (H₂PO₄⁻)', 'sodium hydrogen phosphate (HPO₄²⁻)', 'HPO₄²⁻', 'H₂PO₄⁻', 7.21, 0.01, 'one-hundredth of'],
    ['carbonic acid', 'sodium bicarbonate', 'bicarbonate', 'carbonic acid', 6.35, 10, 'ten times'],
  ];
  for (const [acid, base, baseShort, acidShort, pKa, ratio, phrase] of buffers) {
    const lr = log10(ratio);
    const ph = pKa + lr;
    const power = Math.abs(lr) === 1 ? pKa + 2 * lr : pKa + lr / 2;
    make({
      type: 'acids_bases',
      kps: ['kp-mcat-henderson-hasselbalch'],
      outline: { category: '5A', sirs: 2 },
      difficulty: 2,
      prompt: `A buffer is made from ${acid} (pKa = ${fixed(pKa, 2)}) and ${base}. If the ${baseShort} concentration is ${phrase} the ${acidShort} concentration, what is the pH?`,
      options: options(4, { text: fixed(ph, 2), why: `pH = ${fixed(pKa, 2)} + log(${fmt(ratio)}) = ${fixed(ph, 2)}.` }, [
        { text: fixed(pKa - lr, 2), trap: 'sign_flip', why: 'That uses log([HA]/[A⁻]), which flips the sign of the log term.' },
        { text: fixed(pKa, 2), trap: 'lookalike', why: 'pH equals pKa only when the base and acid concentrations are equal.' },
        { text: fixed(power, 2), trap: 'power_of_ten', why: `log(${fmt(ratio)}) is ${fmt(lr)}, so the pH moves ${fmt(Math.abs(lr))} unit${Math.abs(lr) === 1 ? '' : 's'} from the pKa.` },
      ]),
      tldr: `pH = pKa + log([A⁻]/[HA]) = ${fixed(pKa, 2)} ${lr >= 0 ? '+' : '−'} ${fmt(Math.abs(lr))} = ${fixed(ph, 2)}.`,
      steps: steps(
        ['Recall', 'Henderson–Hasselbalch: pH = pKa + log([A⁻]/[HA]).'],
        ['Compute', `[A⁻]/[HA] = ${fmt(ratio)}, and log(${fmt(ratio)}) = ${fmt(lr)}, so pH = ${fixed(ph, 2)}.`],
        ['Check', ratio > 1 ? 'More base than acid puts the pH above the pKa.' : 'More acid than base puts the pH below the pKa.'],
      ),
      takeaway: 'Each tenfold change in the base-to-acid ratio moves a buffer’s pH by one unit.',
    });
  }

  // 2. Strong acid / strong base pH
  const strong = [
    ['HCl', 'acid', 2],
    ['HNO₃', 'acid', 3],
    ['HCl', 'acid', 4],
    ['NaOH', 'base', 2],
    ['KOH', 'base', 3],
  ];
  for (const [formula, kind, n] of strong) {
    const conc = n === 2 ? '0.01' : n === 3 ? '0.001' : '0.0001';
    const ph = kind === 'acid' ? n : 14 - n;
    const other = 14 - ph;
    make({
      type: 'acids_bases',
      kps: ['kp-mcat-strong-acid-ph'],
      outline: { category: '5A', sirs: 1 },
      difficulty: 1,
      prompt: `What is the pH of a ${conc} M aqueous solution of ${formula} at 25 °C?`,
      options: options(4, { text: String(ph), why: kind === 'acid' ? `[H⁺] = 10⁻${n} M, so pH = ${n}.` : `[OH⁻] = 10⁻${n} M, so pOH = ${n} and pH = 14 − ${n} = ${ph}.` }, [
        { text: String(other), trap: 'lookalike', why: kind === 'acid' ? `That’s the pOH. A strong acid gives pH = −log[H⁺] = ${n}.` : `That’s the pOH. Subtract it from 14 for the pH.` },
        { text: String(ph + 1), trap: 'power_of_ten', why: `${conc} M is 10⁻${n} M, not 10⁻${kind === 'acid' ? n + 1 : n - 1} M.` },
        { text: String(ph - 1), trap: 'power_of_ten', why: `${conc} M is 10⁻${n} M, not 10⁻${kind === 'acid' ? n - 1 : n + 1} M.` },
        { text: '7', trap: 'false_fact', why: 'Only pure water (or a neutral salt) sits at pH 7.' },
      ]),
      tldr: kind === 'acid' ? `${formula} dissociates fully: [H⁺] = 10⁻${n} M, so pH = ${n}.` : `${formula} dissociates fully: pOH = ${n}, so pH = 14 − ${n} = ${ph}.`,
      steps: steps(
        ['Dissociation', `${formula} is a strong ${kind}, so ${kind === 'acid' ? '[H⁺]' : '[OH⁻]'} equals its concentration, 10⁻${n} M.`],
        ['Compute', kind === 'acid' ? `pH = −log(10⁻${n}) = ${n}.` : `pOH = ${n}, and pH + pOH = 14 at 25 °C, so pH = ${ph}.`],
      ),
      takeaway: 'For strong acids, pH = −log(concentration). For strong bases, find pOH first, then pH = 14 − pOH.',
    });
  }

  // 3. Dilution
  const dilutions = [
    [2.0, 50, 250],
    [6.0, 25, 150],
    [0.5, 100, 400],
    [12, 10, 240],
    [1.0, 20, 100],
  ];
  for (const [c1, v1, vf] of dilutions) {
    const c2 = (c1 * v1) / vf;
    make({
      type: 'solutions',
      kps: ['kp-mcat-dilution'],
      outline: { category: '5A', sirs: 2 },
      difficulty: 1,
      prompt: `${fmt(v1)} mL of a ${fmt(c1, 1)} M NaCl solution is diluted with water to a final volume of ${fmt(vf)} mL. What is the new concentration?`,
      options: options(4, { text: `${fmt(c2, 3)} M`, why: `M₂ = M₁V₁/V₂ = (${fmt(c1, 1)} × ${fmt(v1)})/${fmt(vf)} = ${fmt(c2, 3)} M.` }, [
        { text: `${fmt((c1 * vf) / v1, 3)} M`, trap: 'wrong_direction', why: 'That inverts the volume ratio. Dilution can only lower the concentration.' },
        { text: `${fmt((c1 * v1) / (v1 + vf), 3)} M`, trap: 'misread_data', why: `That treats ${fmt(vf)} mL as the water added. ${fmt(vf)} mL is the final volume.` },
        { text: `${fmt(c2 * 10, 3)} M`, trap: 'power_of_ten', why: 'A factor of 10 slipped in. Check the arithmetic.' },
      ]),
      tldr: `M₁V₁ = M₂V₂ → ${fmt(c1, 1)} × ${fmt(v1)} = M₂ × ${fmt(vf)}, so M₂ = ${fmt(c2, 3)} M.`,
      steps: steps(
        ['Set up', 'Moles of solute don’t change: M₁V₁ = M₂V₂.'],
        ['Solve', `M₂ = (${fmt(c1, 1)} M × ${fmt(v1)} mL)/${fmt(vf)} mL = ${fmt(c2, 3)} M.`],
      ),
      takeaway: 'In M₁V₁ = M₂V₂, V₂ is the final total volume, not the water added.',
    });
  }

  // 4. Molar volume at STP
  const stp = [
    ['mol', 0.5],
    ['mol', 2.0],
    ['mol', 0.25],
    ['L', 33.6],
    ['L', 67.2],
  ];
  for (const [given, value] of stp) {
    if (given === 'mol') {
      const v = value * 22.4;
      make({
        type: 'gases',
        kps: ['kp-mcat-molar-volume'],
        outline: { category: '4B', sirs: 1 },
        difficulty: 1,
        prompt: `What volume does ${fmt(value)} mol of an ideal gas occupy at STP (0 °C, 1 atm)?`,
        options: options(4, { text: `${fmt(v, 1)} L`, why: `${fmt(value)} mol × 22.4 L/mol = ${fmt(v, 1)} L.` }, [
          { text: `${fmt(value * 24.5, 1)} L`, trap: 'lookalike', why: '24.5 L/mol is the molar volume near 25 °C, not at STP.' },
          { text: `${fmt(22.4 / value, 1)} L`, trap: 'wrong_direction', why: 'That divides by the moles instead of multiplying.' },
          { text: `${fmt(value * 8.314, 1)} L`, trap: 'lookalike', why: 'That uses the gas constant R as if it were the molar volume.' },
        ]),
        tldr: `At STP each mole takes 22.4 L, so ${fmt(value)} mol occupies ${fmt(v, 1)} L.`,
        steps: steps(['Recall', 'At STP, 1 mol of ideal gas = 22.4 L.'], ['Compute', `${fmt(value)} × 22.4 = ${fmt(v, 1)} L.`]),
        takeaway: 'At STP: volume (L) = moles × 22.4.',
      });
    } else {
      const n = value / 22.4;
      make({
        type: 'gases',
        kps: ['kp-mcat-molar-volume'],
        outline: { category: '4B', sirs: 1 },
        difficulty: 1,
        prompt: `How many moles of an ideal gas occupy ${fmt(value, 1)} L at STP (0 °C, 1 atm)?`,
        options: options(4, { text: `${fmt(n, 2)} mol`, why: `${fmt(value, 1)} L ÷ 22.4 L/mol = ${fmt(n, 2)} mol.` }, [
          { text: `${fmt(value * 22.4, 0)} mol`, trap: 'wrong_direction', why: 'That multiplies by 22.4 instead of dividing.' },
          { text: `${fmt(value / 24.5, 2)} mol`, trap: 'lookalike', why: '24.5 L/mol applies near 25 °C, not at STP.' },
          { text: `${fmt(n * 2, 2)} mol`, trap: 'power_of_ten', why: 'That doubles the correct answer. Recheck the division.' },
        ]),
        tldr: `Moles = ${fmt(value, 1)} L ÷ 22.4 L/mol = ${fmt(n, 2)} mol.`,
        steps: steps(['Recall', 'At STP, 22.4 L holds 1 mol of ideal gas.'], ['Compute', `${fmt(value, 1)} ÷ 22.4 = ${fmt(n, 2)} mol.`]),
        takeaway: 'At STP: moles = volume (L) ÷ 22.4.',
      });
    }
  }

  // 5. Combined gas law
  const gasChanges = [
    ['doubled', 2, 'tripled', 3],
    ['tripled', 3, 'increased by half', 1.5],
    ['halved', 0.5, 'doubled', 2],
    ['quadrupled', 4, 'doubled', 2],
    ['unchanged', 1, 'raised from 27 °C to 327 °C', 2],
  ];
  for (const [pWord, pf, tWord, tf] of gasChanges) {
    const v = tf / pf;
    const kelvinTrap = tWord.includes('°C');
    make({
      type: 'gases',
      kps: ['kp-mcat-combined-gas', ...(kelvinTrap ? ['kp-mcat-gas-kelvin'] : [])],
      outline: { category: '4B', sirs: 2 },
      difficulty: 2,
      prompt:
        pf === 1
          ? `A sample of ideal gas is held at constant pressure while its temperature is ${tWord}. By what factor does its volume change?`
          : `A sample of ideal gas has its pressure ${pWord} while its temperature is ${tWord}${kelvinTrap ? '' : ' (in kelvin)'}. By what factor does its volume change?`,
      options: options(4, { text: `${fmt(v)}× the original`, why: `V ∝ T/P, so V changes by ${fmt(tf)}/${fmt(pf)} = ${fmt(v)}.` }, [
        { text: `${fmt(tf * pf)}× the original`, trap: 'lookalike', why: 'That multiplies the factors. Volume rises with T but falls with P.' },
        { text: `${fmt(pf / tf)}× the original`, trap: 'wrong_direction', why: 'That inverts the relationship: V ∝ T/P, not P/T.' },
        ...(kelvinTrap
          ? [{ text: `${fmt(327 / 27, 1)}× the original`, trap: 'power_of_ten', why: 'That uses Celsius. Gas laws need kelvin: 300 K → 600 K.' }]
          : [{ text: '1× the original', trap: 'false_fact', why: 'The changes don’t cancel here. Compute T/P.' }]),
        { text: `${fmt(v * 2)}× the original`, trap: 'skipped_step', why: 'Recheck the ratio of the temperature and pressure factors.' },
      ]),
      tldr: `PV/T is constant, so V scales by T/P = ${fmt(tf)}/${fmt(pf)} = ${fmt(v)}.`,
      steps: steps(
        ['Relationship', 'For a fixed amount of gas, V ∝ T/P (T in kelvin).'],
        ['Apply', kelvinTrap ? '27 °C = 300 K and 327 °C = 600 K, so T doubles while P stays the same.' : `T changes by ${fmt(tf)}× and P by ${fmt(pf)}×.`],
        ['Compute', `V changes by ${fmt(tf)}/${fmt(pf)} = ${fmt(v)}.`],
      ),
      takeaway: 'Volume scales with kelvin temperature and inversely with pressure: V₂/V₁ = (T₂/T₁)(P₁/P₂).',
    });
  }

  // 6. Resistor networks
  const networks = [
    [12, 6, 24, 'parallel', 'current'],
    [4, 4, 8, 'parallel', 'current'],
    [10, 10, 20, 'series', 'current'],
    [2, 6, 12, 'parallel', 'current'],
    [3, 6, 18, 'series', 'current'],
    [20, 30, null, 'parallel', 'resistance'],
  ];
  for (const [r1, r2, v, config, ask] of networks) {
    const par = (r1 * r2) / (r1 + r2);
    const ser = r1 + r2;
    const req = config === 'parallel' ? par : ser;
    if (ask === 'resistance') {
      make({
        type: 'circuits',
        kps: ['kp-mcat-parallel-resistors'],
        outline: { category: '4C', sirs: 2 },
        difficulty: 1,
        prompt: `What is the equivalent resistance of a ${r1} Ω resistor and a ${r2} Ω resistor connected in parallel?`,
        options: options(4, { text: `${fmt(par)} Ω`, why: `(${r1} × ${r2})/(${r1} + ${r2}) = ${fmt(par)} Ω, smaller than either resistor.` }, [
          { text: `${fmt(ser)} Ω`, trap: 'lookalike', why: 'That’s the series total. Parallel resistance is smaller than either branch.' },
          { text: `${fmt((r1 + r2) / 2)} Ω`, trap: 'lookalike', why: 'Resistances don’t average. Add reciprocals for parallel.' },
          { text: `${fmt(1 / r1 + 1 / r2, 3)} Ω`, trap: 'skipped_step', why: 'That’s 1/R. Take the reciprocal to get R.' },
        ]),
        tldr: `1/R = 1/${r1} + 1/${r2}, so R = ${fmt(par)} Ω.`,
        steps: steps(['Recall', 'Parallel: 1/R = 1/R₁ + 1/R₂, or R = R₁R₂/(R₁ + R₂).'], ['Compute', `R = ${r1 * r2}/${r1 + r2} = ${fmt(par)} Ω.`]),
        takeaway: 'Adding a resistor in parallel always lowers the total resistance.',
      });
      continue;
    }
    const i = v / req;
    const alt = v / (config === 'parallel' ? ser : par);
    make({
      type: 'circuits',
      kps: ['kp-mcat-parallel-resistors'],
      outline: { category: '4C', sirs: 2 },
      difficulty: 2,
      prompt: `A ${r1} Ω resistor and a ${r2} Ω resistor are connected in ${config} across an ideal ${v} V battery. What total current does the battery supply?`,
      options: options(4, { text: `${fmt(i)} A`, why: `R = ${fmt(req)} Ω, so I = ${v} V ÷ ${fmt(req)} Ω = ${fmt(i)} A.` }, [
        { text: `${fmt(alt)} A`, trap: 'lookalike', why: `That treats the resistors as if they were in ${config === 'parallel' ? 'series' : 'parallel'}.` },
        { text: `${fmt(v / r1)} A`, trap: 'skipped_step', why: `That uses only the ${r1} Ω resistor.` },
        { text: `${fmt(v / r2)} A`, trap: 'skipped_step', why: `That uses only the ${r2} Ω resistor.` },
        { text: `${fmt(v * req)} A`, trap: 'lookalike', why: 'That multiplies V by R. Ohm’s law gives I = V/R.' },
      ]),
      tldr: `${config === 'parallel' ? 'Parallel' : 'Series'}: R = ${fmt(req)} Ω, so I = ${v}/${fmt(req)} = ${fmt(i)} A.`,
      steps: steps(
        ['Combine', config === 'parallel' ? `R = (${r1} × ${r2})/(${r1} + ${r2}) = ${fmt(req)} Ω.` : `R = ${r1} + ${r2} = ${fmt(req)} Ω.`],
        ['Ohm’s law', `I = V/R = ${v}/${fmt(req)} = ${fmt(i)} A.`],
      ),
      takeaway: config === 'parallel' ? 'Parallel branches each get the full voltage, and their currents add.' : 'Series resistors carry the same current, and their resistances add.',
    });
  }

  // 7. Electric power
  const powers = [
    [10, 20],
    [5, 10],
    [50, 100],
    [8, 4],
  ];
  for (const [r, v] of powers) {
    const p = (v * v) / r;
    make({
      type: 'circuits',
      kps: ['kp-mcat-electric-power'],
      outline: { category: '4C', sirs: 2 },
      difficulty: 1,
      prompt: `A ${r} Ω resistor is connected across a ${v} V source. How much power does it dissipate?`,
      options: options(4, { text: `${fmt(p)} W`, why: `P = V²/R = ${v}²/${r} = ${fmt(p)} W.` }, [
        { text: `${fmt(v / r)} W`, trap: 'lookalike', why: `V/R = ${fmt(v / r)} is the current in amperes, not the power.` },
        { text: `${fmt(v * r)} W`, trap: 'lookalike', why: 'V × R isn’t a power formula. Use V²/R or IV.' },
        { text: `${fmt(p / 2)} W`, trap: 'skipped_step', why: 'There’s no ½ in P = V²/R. That factor belongs to capacitor energy.' },
      ]),
      tldr: `P = V²/R = ${v * v}/${r} = ${fmt(p)} W.`,
      steps: steps(['Pick the formula', 'With V and R known, P = V²/R.'], ['Compute', `${v}² = ${v * v}; ${v * v}/${r} = ${fmt(p)} W.`]),
      takeaway: 'P = IV = I²R = V²/R. Choose the form that matches the quantities you know.',
    });
  }
  make({
    type: 'circuits',
    kps: ['kp-mcat-electric-power'],
    outline: { category: '4C', sirs: 2 },
    difficulty: 2,
    prompt: 'The voltage across a fixed resistor is doubled. What happens to the power it dissipates?',
    options: options(4, { text: 'It quadruples.', why: 'P = V²/R, so doubling V multiplies P by 2² = 4.' }, [
      { text: 'It doubles.', trap: 'skipped_step', why: 'Power depends on V squared, not V.' },
      { text: 'It stays the same.', trap: 'false_fact', why: 'With R fixed, power rises with voltage.' },
      { text: 'It halves.', trap: 'wrong_direction', why: 'More voltage across the same resistor means more power.' },
    ]),
    tldr: 'P = V²/R, so 2× voltage gives 4× power.',
    steps: steps(['Formula', 'At constant R, P = V²/R.'], ['Scale', 'V → 2V gives P → (2V)²/R = 4P.']),
    takeaway: 'Power through a fixed resistor scales with the square of voltage (or current).',
  });

  // 8. Capacitors
  const caps = [
    ['charge', 10, 5],
    ['charge', 2, 12],
    ['energy', 4, 10],
    ['energy', 20, 3],
  ];
  for (const [ask, c, v] of caps) {
    if (ask === 'charge') {
      make({
        type: 'circuits',
        kps: ['kp-mcat-capacitors'],
        outline: { category: '4C', sirs: 1 },
        difficulty: 1,
        prompt: `A ${c} µF capacitor is charged to ${v} V. How much charge is stored on it?`,
        options: options(4, { text: `${fmt(c * v)} µC`, why: `Q = CV = ${c} µF × ${v} V = ${fmt(c * v)} µC.` }, [
          { text: `${fmt(c / v, 2)} µC`, trap: 'lookalike', why: 'That divides C by V. Q = CV.' },
          { text: `${fmt(0.5 * c * v * v)} µC`, trap: 'lookalike', why: '½CV² is the stored energy (in µJ), not the charge.' },
          { text: `${fmt(v / c, 2)} µC`, trap: 'lookalike', why: 'That divides V by C. Q = CV.' },
        ]),
        tldr: `Q = CV = ${c} × ${v} = ${fmt(c * v)} µC.`,
        steps: steps(['Recall', 'Q = CV.'], ['Compute', `${c} µF × ${v} V = ${fmt(c * v)} µC.`]),
        takeaway: 'Capacitance is charge per volt: Q = CV.',
      });
    } else {
      const u = 0.5 * c * v * v;
      make({
        type: 'circuits',
        kps: ['kp-mcat-capacitors'],
        outline: { category: '4C', sirs: 2 },
        difficulty: 2,
        prompt: `How much energy is stored in a ${c} µF capacitor charged to ${v} V?`,
        options: options(4, { text: `${fmt(u)} µJ`, why: `U = ½CV² = ½ × ${c} × ${v}² = ${fmt(u)} µJ.` }, [
          { text: `${fmt(c * v * v)} µJ`, trap: 'skipped_step', why: 'That leaves out the ½ in U = ½CV².' },
          { text: `${fmt(0.5 * c * v)} µJ`, trap: 'skipped_step', why: 'Voltage must be squared: U = ½CV².' },
          { text: `${fmt(c * v)} µJ`, trap: 'lookalike', why: 'CV is the charge in µC, not the energy.' },
        ]),
        tldr: `U = ½CV² = ½(${c})(${v * v}) = ${fmt(u)} µJ.`,
        steps: steps(['Recall', 'Energy stored in a capacitor: U = ½CV².'], ['Compute', `½ × ${c} × ${v * v} = ${fmt(u)} µJ.`]),
        takeaway: 'Capacitor energy: U = ½CV² = ½QV = Q²/(2C).',
      });
    }
  }

  // 9. Coulomb's law scaling
  const coulomb = [
    ['One charge is doubled and the distance between them is doubled.', 2, 2, 'F/2'],
    ['One charge is tripled and the distance is tripled.', 3, 3, 'F/3'],
    ['Both charges are doubled and the distance stays the same.', 4, 1, '4F'],
    ['The distance between them is tripled.', 1, 3, 'F/9'],
    ['One charge is doubled and the distance is halved.', 2, 0.5, '8F'],
  ];
  const fLabel = (x) => (Math.abs(x - 1) < 1e-9 ? 'F' : x > 1 ? `${fmt(x)}F` : `F/${fmt(1 / x)}`);
  for (const [change, qf, rf, label] of coulomb) {
    const f = qf / (rf * rf);
    if (fLabel(f) !== label) throw new Error(`coulomb label mismatch ${label}`);
    make({
      type: 'electrostatics',
      kps: ['kp-mcat-coulomb'],
      outline: { category: '4C', sirs: 2 },
      difficulty: 2,
      prompt: `Two point charges exert an electric force F on each other. ${change} What is the new force?`,
      options: options(4, { text: label, why: `F ∝ q₁q₂/r²: the charges contribute ×${fmt(qf)} and the distance ×1/${fmt(rf * rf)}, giving ${label}.` }, [
        { text: fLabel(qf / rf), trap: 'skipped_step', why: 'That forgets to square the distance factor.' },
        { text: fLabel(qf * rf * rf), trap: 'wrong_direction', why: 'Force falls as distance grows: divide by r², don’t multiply.' },
        { text: fLabel(qf * qf / (rf * rf)), trap: 'lookalike', why: 'Only the charges that changed count, and each charge enters to the first power.' },
        { text: 'F', trap: 'false_fact', why: 'The changes don’t cancel. Apply F ∝ q₁q₂/r².' },
        { text: fLabel(f * 2), trap: 'skipped_step', why: 'Recheck: multiply the charge factors, then divide by the distance factor squared.' },
        { text: fLabel(f / 2), trap: 'skipped_step', why: 'Recheck: multiply the charge factors, then divide by the distance factor squared.' },
      ]),
      tldr: `F ∝ q₁q₂/r², so the force becomes ${label}.`,
      steps: steps(['Law', 'F = kq₁q₂/r².'], ['Scale', `Charge factor ${fmt(qf)}; distance factor ${fmt(rf)} squared is ${fmt(rf * rf)}; ${fmt(qf)}/${fmt(rf * rf)} → ${label}.`]),
      takeaway: 'Electric force is proportional to each charge and inversely proportional to distance squared.',
    });
  }

  // 10. Free fall
  const falls = [
    ['time', 45],
    ['time', 80],
    ['speed_after_time', 4],
    ['distance', 3],
    ['impact_speed', 20],
  ];
  for (const [ask, value] of falls) {
    if (ask === 'time') {
      const t = Math.sqrt((2 * value) / 10);
      make({
        type: 'kinematics',
        kps: ['kp-mcat-free-fall'],
        outline: { category: '4A', sirs: 2 },
        difficulty: 1,
        prompt: `A stone is dropped from rest from a height of ${value} m. Ignoring air resistance (g ≈ 10 m/s²), how long does it take to reach the ground?`,
        options: options(4, { text: `${fmt(t)} s`, why: `${value} = ½(10)t², so t² = ${fmt(t * t)} and t = ${fmt(t)} s.` }, [
          { text: `${fmt(Math.sqrt(value / 10), 1)} s`, trap: 'lookalike', why: 'That drops the ½ from h = ½gt².' },
          { text: `${fmt(t * t)} s`, trap: 'skipped_step', why: 'That’s t². Take the square root.' },
          { text: `${fmt(value / 10, 1)} s`, trap: 'lookalike', why: 'h/g isn’t a time formula here; the stone accelerates.' },
        ]),
        tldr: `h = ½gt² → ${value} = 5t² → t = ${fmt(t)} s.`,
        steps: steps(['Recall', 'From rest: h = ½gt².'], ['Solve', `t = √(2h/g) = √(${2 * value}/10) = ${fmt(t)} s.`]),
        takeaway: 'Dropped from rest: t = √(2h/g), and mass doesn’t matter.',
      });
    } else if (ask === 'speed_after_time') {
      make({
        type: 'kinematics',
        kps: ['kp-mcat-free-fall'],
        outline: { category: '4A', sirs: 1 },
        difficulty: 1,
        prompt: `An object falls from rest for ${value} s. Ignoring air resistance (g ≈ 10 m/s²), how fast is it moving?`,
        options: options(4, { text: `${10 * value} m/s`, why: `v = gt = 10 × ${value} = ${10 * value} m/s.` }, [
          { text: `${5 * value * value} m/s`, trap: 'lookalike', why: `½gt² = ${5 * value * value} is the distance fallen in meters, not the speed.` },
          { text: `${5 * value} m/s`, trap: 'lookalike', why: 'That’s the average speed over the fall, not the final speed.' },
          { text: `${10 * value * value} m/s`, trap: 'lookalike', why: 'Speed grows linearly with time: v = gt.' },
        ]),
        tldr: `v = gt = 10 × ${value} = ${10 * value} m/s.`,
        steps: steps(['Recall', 'Starting from rest, v = gt.'], ['Compute', `10 m/s² × ${value} s = ${10 * value} m/s.`]),
        takeaway: 'In free fall, speed increases by about 10 m/s every second.',
      });
    } else if (ask === 'distance') {
      make({
        type: 'kinematics',
        kps: ['kp-mcat-free-fall'],
        outline: { category: '4A', sirs: 2 },
        difficulty: 1,
        prompt: `How far does an object fall from rest in ${value} s, ignoring air resistance (g ≈ 10 m/s²)?`,
        options: options(4, { text: `${5 * value * value} m`, why: `d = ½gt² = 5 × ${value * value} = ${5 * value * value} m.` }, [
          { text: `${10 * value} m`, trap: 'lookalike', why: `gt = ${10 * value} is the final speed in m/s, not the distance.` },
          { text: `${10 * value * value} m`, trap: 'skipped_step', why: 'That leaves out the ½ in d = ½gt².' },
          { text: `${5 * value} m`, trap: 'skipped_step', why: 'Time must be squared: d = ½gt².' },
        ]),
        tldr: `d = ½gt² = ½(10)(${value})² = ${5 * value * value} m.`,
        steps: steps(['Recall', 'From rest, d = ½gt².'], ['Compute', `½ × 10 × ${value * value} = ${5 * value * value} m.`]),
        takeaway: 'Distance fallen from rest grows with the square of time.',
      });
    } else {
      const v = Math.sqrt(2 * 10 * value);
      make({
        type: 'work_energy',
        kps: ['kp-mcat-kinetic-energy'],
        outline: { category: '4A', sirs: 2 },
        difficulty: 2,
        prompt: `A block slides from rest down a frictionless ramp, dropping a vertical height of ${value} m. How fast is it moving at the bottom? (g ≈ 10 m/s²)`,
        options: options(4, { text: `${fmt(v)} m/s`, why: `mgh = ½mv² gives v = √(2gh) = √${2 * 10 * value} = ${fmt(v)} m/s.` }, [
          { text: `${fmt(2 * 10 * value)} m/s`, trap: 'skipped_step', why: 'That’s v², not v. Take the square root.' },
          { text: `${fmt(Math.sqrt(10 * value), 1)} m/s`, trap: 'skipped_step', why: 'That drops the 2 in v = √(2gh).' },
          { text: 'It depends on the block’s mass.', trap: 'false_fact', why: 'Mass cancels: mgh = ½mv².' },
        ]),
        tldr: `Energy conservation: v = √(2gh) = √${2 * 10 * value} = ${fmt(v)} m/s.`,
        steps: steps(['Conserve energy', 'With no friction, mgh = ½mv².'], ['Solve', `v = √(2gh) = √(2 × 10 × ${value}) = ${fmt(v)} m/s.`]),
        takeaway: 'On a frictionless path, speed at the bottom depends only on the height dropped: v = √(2gh).',
      });
    }
  }

  // 11. Horizontal launch
  const launches = [
    [20, 5],
    [45, 10],
    [5, 4],
    [80, 3],
    [1.25, 2],
  ];
  for (const [h, vx] of launches) {
    const t = Math.sqrt((2 * h) / 10);
    const x = vx * t;
    make({
      type: 'kinematics',
      kps: ['kp-mcat-projectile'],
      outline: { category: '4A', sirs: 2 },
      difficulty: 3,
      prompt: `A ball rolls off a horizontal ledge ${fmt(h)} m high at ${vx} m/s. Ignoring air resistance (g ≈ 10 m/s²), how far from the base of the ledge does it land?`,
      options: options(4, { text: `${fmt(x)} m`, why: `Fall time t = √(2h/g) = ${fmt(t)} s, so x = ${vx} × ${fmt(t)} = ${fmt(x)} m.` }, [
        { text: `${fmt(vx * Math.sqrt(h / 10), 2)} m`, trap: 'lookalike', why: 'That drops the ½ in h = ½gt² when finding the fall time.' },
        { text: `${fmt(vx * t * t, 2)} m`, trap: 'skipped_step', why: 'That multiplies by t² instead of t.' },
        { text: `${fmt(h)} m`, trap: 'misread_data', why: 'That’s the height, not the horizontal distance.' },
        { text: `${fmt(x * 2)} m`, trap: 'skipped_step', why: 'Recheck the fall time: t = √(2h/g).' },
        { text: `${fmt(x / 2)} m`, trap: 'skipped_step', why: 'Recheck the fall time: t = √(2h/g).' },
        { text: `${fmt(vx * Math.sqrt(2 * h), 1)} m`, trap: 'skipped_step', why: 'That leaves g out of t = √(2h/g).' },
      ]),
      tldr: `t = √(2h/g) = ${fmt(t)} s; x = v·t = ${vx} × ${fmt(t)} = ${fmt(x)} m.`,
      steps: steps(
        ['Vertical', `Falling ${fmt(h)} m from rest takes t = √(2 × ${fmt(h)}/10) = ${fmt(t)} s.`],
        ['Horizontal', `No horizontal acceleration, so x = ${vx} m/s × ${fmt(t)} s = ${fmt(x)} m.`],
      ),
      takeaway: 'Treat horizontal and vertical motion separately. The height alone sets the flight time.',
    });
  }

  // 12. Kinetic energy scaling
  const keScale = [
    ['its speed doubles', 1, 2],
    ['its speed triples', 1, 3],
    ['its mass doubles and its speed is halved', 2, 0.5],
    ['its mass is halved and its speed doubles', 0.5, 2],
  ];
  for (const [change, mf, vf] of keScale) {
    const k = mf * vf * vf;
    const kLabel = (x) => (Math.abs(x - 1) < 1e-9 ? 'K (unchanged)' : `${fmt(x)}K`);
    const word = (x) => (Math.abs(x - 1) < 1e-9 ? 'unchanged' : `${fmt(x)}× as large`);
    make({
      type: 'work_energy',
      kps: ['kp-mcat-kinetic-energy'],
      outline: { category: '4A', sirs: 2 },
      difficulty: 2,
      prompt: `A moving cart’s kinetic energy is K. If ${change}, what is its new kinetic energy?`,
      options: options(4, { text: kLabel(k), why: `KE = ½mv²: mass factor ${fmt(mf)} × speed factor squared ${fmt(vf * vf)} = ${fmt(k)}.` }, [
        { text: kLabel(mf * vf), trap: 'skipped_step', why: 'Speed enters KE squared, not to the first power.' },
        { text: kLabel(mf * mf * vf), trap: 'lookalike', why: 'Mass enters KE to the first power; it’s speed that’s squared.' },
        { text: kLabel(k * 2), trap: 'skipped_step', why: 'Recheck: multiply the mass factor by the square of the speed factor.' },
        { text: kLabel(1), trap: 'false_fact', why: 'These changes don’t cancel out here. Compute m × v².' },
        { text: kLabel(mf * vf ** 4), trap: 'lookalike', why: 'Speed is squared once, not raised to the fourth power.' },
      ]),
      tldr: `KE ∝ mv², so the factor is ${fmt(mf)} × ${fmt(vf)}² = ${fmt(k)}; the new energy is ${word(k)}.`,
      steps: steps(['Formula', 'KE = ½mv².'], ['Scale', `${fmt(mf)} × (${fmt(vf)})² = ${fmt(k)}.`]),
      takeaway: 'Kinetic energy scales with mass and with the square of speed.',
    });
  }

  // 13. Work and power
  const workPower = [
    ['push', 50, 4, 2],
    ['push', 100, 3, 6],
    ['push', 60, 5, 10],
    ['lift', 10, 2, 4],
  ];
  for (const [kind, a, d, t] of workPower) {
    const w = kind === 'push' ? a * d : a * 10 * d;
    const p = w / t;
    make({
      type: 'work_energy',
      kps: ['kp-mcat-work-power'],
      outline: { category: '4A', sirs: 2 },
      difficulty: 2,
      prompt:
        kind === 'push'
          ? `A constant ${a} N horizontal force pushes a crate ${d} m across the floor in the direction of the force, taking ${t} s. What average power does the force deliver?`
          : `A motor lifts a ${a} kg mass ${d} m straight up at constant speed in ${t} s. What average power does it deliver? (g ≈ 10 m/s²)`,
      options: options(4, { text: `${fmt(p)} W`, why: `W = ${kind === 'push' ? `Fd = ${a} × ${d}` : `mgh = ${a} × 10 × ${d}`} = ${fmt(w)} J, and P = ${fmt(w)}/${t} = ${fmt(p)} W.` }, [
        { text: `${fmt(w)} W`, trap: 'skipped_step', why: `${fmt(w)} J is the work. Divide by time for power.` },
        { text: `${fmt(w * t)} W`, trap: 'wrong_direction', why: 'Power is work divided by time, not multiplied.' },
        { text: `${fmt(kind === 'push' ? (a * t) / d : (a * d) / t, 2)} W`, trap: 'lookalike', why: kind === 'push' ? 'That combines the numbers incorrectly; P = Fd/t.' : 'That leaves out g. Lifting work is mgh.' },
      ]),
      tldr: `W = ${fmt(w)} J over ${t} s → P = ${fmt(p)} W.`,
      steps: steps(['Work', kind === 'push' ? `W = Fd = ${a} N × ${d} m = ${fmt(w)} J.` : `W = mgh = ${a} × 10 × ${d} = ${fmt(w)} J.`], ['Power', `P = W/t = ${fmt(w)}/${t} = ${fmt(p)} W.`]),
      takeaway: 'Power is the rate of doing work: P = W/t.',
    });
  }

  // 14. Pressure at depth
  const depths = [
    ['gauge', 10],
    ['gauge', 20],
    ['absolute', 30],
    ['gauge', 5],
    ['absolute', 10],
  ];
  for (const [kind, h] of depths) {
    const gauge = 1000 * 10 * h; // Pa
    const ans = kind === 'gauge' ? gauge : gauge + 1e5;
    const kpa = (x) => `${fmt(x / 1000)} kPa`;
    make({
      type: 'fluids',
      kps: ['kp-mcat-hydrostatic'],
      outline: { category: '4B', sirs: 2 },
      difficulty: 2,
      prompt: `What is the ${kind} pressure at a depth of ${h} m in fresh water? (ρ = 1000 kg/m³, g ≈ 10 m/s², atmospheric pressure ≈ 100 kPa)`,
      options: options(4, { text: kpa(ans), why: kind === 'gauge' ? `ρgh = 1000 × 10 × ${h} = ${fmt(gauge / 1000)} kPa.` : `ρgh = ${fmt(gauge / 1000)} kPa, plus 100 kPa at the surface = ${fmt(ans / 1000)} kPa.` }, [
        { text: kpa(kind === 'gauge' ? gauge + 1e5 : gauge), trap: 'lookalike', why: kind === 'gauge' ? 'That adds atmospheric pressure. Gauge pressure leaves it out.' : 'That’s the gauge pressure. Absolute adds the 100 kPa at the surface.' },
        { text: kpa(gauge / 10), trap: 'skipped_step', why: 'That leaves out g in ρgh.' },
        { text: kpa(gauge * 10), trap: 'power_of_ten', why: 'A factor of 10 slipped in. Check ρgh in pascals.' },
      ]),
      tldr: kind === 'gauge' ? `Gauge pressure = ρgh = ${fmt(gauge / 1000)} kPa.` : `Absolute = 100 kPa + ρgh = ${fmt(ans / 1000)} kPa.`,
      steps: steps(['Gauge', `ρgh = 1000 × 10 × ${h} = ${fmt(gauge)} Pa = ${fmt(gauge / 1000)} kPa.`], ['Type', kind === 'gauge' ? 'Gauge pressure excludes the atmosphere.' : 'Absolute pressure adds about 100 kPa of atmosphere.']),
      takeaway: 'Every 10 m of water adds about 100 kPa (1 atm). Gauge excludes the atmosphere; absolute includes it.',
    });
  }

  // 15. Floating objects
  const floats = [
    ['a block of wood', 600, 'fresh water', 1000],
    ['an ice cube', 900, 'fresh water', 1000],
    ['a plastic ball', 250, 'fresh water', 1000],
    ['a block of wood', 600, 'oil', 800],
  ];
  for (const [obj, dObj, fluid, dFluid] of floats) {
    const f = dObj / dFluid;
    make({
      type: 'fluids',
      kps: ['kp-mcat-buoyancy'],
      outline: { category: '4B', sirs: 2 },
      difficulty: 2,
      prompt: `${obj[0].toUpperCase()}${obj.slice(1)} with density ${dObj} kg/m³ floats in ${fluid} (density ${dFluid} kg/m³). What fraction of its volume is below the surface?`,
      options: options(4, { text: `${fmt(f * 100)}%`, why: `Submerged fraction = ${dObj}/${dFluid} = ${fmt(f * 100)}%.` }, [
        { text: `${fmt((1 - f) * 100)}%`, trap: 'wrong_direction', why: 'That’s the fraction above the surface.' },
        { text: `${fmt((dFluid / dObj) * 100)}%`, trap: 'wrong_direction', why: 'That inverts the ratio; a floating object can’t be more than 100% submerged.' },
        { text: '100%', trap: 'false_fact', why: 'It floats because it’s less dense than the fluid, so part of it stays above the surface.' },
      ]),
      tldr: `A floating object is submerged by ρ_object/ρ_fluid = ${fmt(f * 100)}%.`,
      steps: steps(['Balance', 'Floating: buoyant force = weight, so ρ_fluid·V_sub·g = ρ_obj·V·g.'], ['Solve', `V_sub/V = ${dObj}/${dFluid} = ${fmt(f * 100)}%.`]),
      takeaway: 'Submerged fraction of a floating object = its density ÷ the fluid’s density.',
    });
  }

  // 16. Continuity with radius changes
  const radii = [
    ['the pipe’s radius is halved', 0.5],
    ['the pipe’s radius doubles', 2],
    ['the pipe’s diameter shrinks to one-third', 1 / 3],
    ['the pipe’s radius shrinks to one-quarter', 0.25],
  ];
  for (const [change, rf] of radii) {
    const vf = 1 / (rf * rf);
    const lab = (x) => (x >= 1 ? `${fmt(x)}× as fast` : `1/${fmt(1 / x)} as fast`);
    make({
      type: 'fluids',
      kps: ['kp-mcat-continuity'],
      outline: { category: '4B', sirs: 2 },
      difficulty: 2,
      prompt: `Water flows steadily through a horizontal pipe. Downstream, ${change}. How does the water’s speed there compare with its upstream speed?`,
      options: options(4, { text: lab(vf), why: `A ∝ r², so speed scales by 1/(${fmt(rf, 3)})² = ${fmt(vf, 3)}.` }, [
        { text: lab(1 / rf), trap: 'skipped_step', why: 'That uses the radius ratio without squaring it. Area depends on r².' },
        { text: lab(rf * rf), trap: 'wrong_direction', why: 'That inverts the relationship: speed rises where area falls.' },
        { text: lab(vf * vf), trap: 'lookalike', why: 'Area goes with r², not r⁴.' },
      ]),
      tldr: `A₁v₁ = A₂v₂ and A ∝ r², so the speed changes by a factor of ${fmt(vf, 3)}.`,
      steps: steps(['Continuity', 'A₁v₁ = A₂v₂ for an incompressible fluid.'], ['Scale', `Area changes by (${fmt(rf, 3)})² = ${fmt(rf * rf, 4)}, so speed changes by ${fmt(vf, 3)}.`]),
      takeaway: 'Speed scales inversely with area, which goes with the radius squared.',
    });
  }

  // 17. Thin lenses
  const lenses = [
    [20, 60],
    [10, 20],
    [5, 15],
    [15, 10],
    [8, 24],
  ];
  for (const [f, dObj] of lenses) {
    const di = 1 / (1 / f - 1 / dObj);
    const real = di > 0;
    const desc = (x) => (x > 0 ? `${fmt(x)} cm on the opposite side (real)` : `${fmt(-x)} cm on the object’s side (virtual)`);
    const sum = 1 / (1 / f + 1 / dObj);
    make({
      type: 'optics',
      kps: ['kp-mcat-thin-lens'],
      outline: { category: '4D', sirs: 2 },
      difficulty: 3,
      prompt: `An object is placed ${dObj} cm from a converging lens with a focal length of ${f} cm. Where does the image form?`,
      options: options(4, { text: desc(di), why: `1/dᵢ = 1/${f} − 1/${dObj}, so dᵢ = ${fmt(di)} cm (${real ? 'positive: real, inverted' : 'negative: virtual, upright'}).` }, [
        { text: desc(-di), trap: 'sign_flip', why: real ? 'A positive dᵢ means a real image on the far side of the lens.' : 'A negative dᵢ means a virtual image on the object’s side.' },
        { text: desc(sum), trap: 'sign_flip', why: 'That adds 1/dₒ to 1/f instead of subtracting it.' },
        { text: desc(dObj - f), trap: 'lookalike', why: 'dₒ − f isn’t the lens equation. Use 1/f = 1/dₒ + 1/dᵢ.' },
        { text: desc(f), trap: 'lookalike', why: 'Images form at the focal point only for distant objects.' },
      ]),
      tldr: `1/dᵢ = 1/f − 1/dₒ = 1/${f} − 1/${dObj} → dᵢ = ${fmt(di)} cm (${real ? 'real' : 'virtual'}).`,
      steps: steps(
        ['Equation', '1/f = 1/dₒ + 1/dᵢ.'],
        ['Solve', `1/dᵢ = 1/${f} − 1/${dObj} → dᵢ = ${fmt(di)} cm.`],
        ['Interpret', real ? 'Object outside f: real, inverted image on the far side.' : 'Object inside f: virtual, upright, magnified image on the object’s side.'],
      ),
      takeaway: 'For a converging lens, objects beyond f give real images; objects inside f give virtual ones.',
    });
  }

  // 18. Magnification
  for (const [f, dObj] of [
    [10, 30],
    [10, 15],
    [20, 10],
    [15, 25],
  ]) {
    const di = 1 / (1 / f - 1 / dObj);
    const m = -di / dObj;
    const describe = (x) => `${fmt(x)} (${x < 0 ? 'inverted' : 'upright'}, ${Math.abs(x) < 1 ? 'smaller' : Math.abs(x) > 1 ? 'larger' : 'same size'})`;
    make({
      type: 'optics',
      kps: ['kp-mcat-magnification', 'kp-mcat-thin-lens'],
      outline: { category: '4D', sirs: 2 },
      difficulty: 3,
      prompt: `An object sits ${dObj} cm from a converging lens of focal length ${f} cm. What is the magnification of the image?`,
      options: options(4, { text: describe(m), why: `dᵢ = ${fmt(di)} cm, so m = −dᵢ/dₒ = −(${fmt(di)})/${dObj} = ${fmt(m)}.` }, [
        { text: describe(-m), trap: 'sign_flip', why: 'Magnification is −dᵢ/dₒ; the sign shows orientation.' },
        { text: describe(1 / m), trap: 'wrong_direction', why: 'That inverts the ratio. Use dᵢ/dₒ, not dₒ/dᵢ.' },
        { text: describe(-1 / m), trap: 'lookalike', why: 'That uses dₒ/dᵢ and drops the sign convention.' },
      ]),
      tldr: `dᵢ = ${fmt(di)} cm and m = −dᵢ/dₒ = ${fmt(m)}.`,
      steps: steps(['Image distance', `1/dᵢ = 1/${f} − 1/${dObj} → dᵢ = ${fmt(di)} cm.`], ['Magnification', `m = −dᵢ/dₒ = ${fmt(m)}.`]),
      takeaway: 'm = −dᵢ/dₒ: the sign gives orientation and the size gives scale.',
    });
  }

  // 19. Lens power
  for (const [fcm, kind] of [
    [25, 'converging'],
    [50, 'converging'],
    [-20, 'diverging'],
    [10, 'converging'],
  ]) {
    const p = 100 / fcm;
    make({
      type: 'optics',
      kps: ['kp-mcat-lens-power'],
      outline: { category: '4D', sirs: 1 },
      difficulty: 1,
      prompt: `What is the power of a ${kind} lens with a focal length of ${fcm} cm?`,
      options: options(4, { text: `${fmt(p)} D`, why: `P = 1/f = 1/(${fmt(fcm / 100)} m) = ${fmt(p)} D.` }, [
        { text: `${fmt(1 / fcm, 3)} D`, trap: 'power_of_ten', why: 'Focal length must be in meters, not centimeters.' },
        { text: `${fmt(-p)} D`, trap: 'sign_flip', why: `${kind === 'converging' ? 'Converging lenses have positive power.' : 'Diverging lenses have negative power.'}` },
        { text: `${fmt(fcm / 100)} D`, trap: 'wrong_direction', why: 'That’s f in meters. Power is its reciprocal.' },
        { text: `${fmt(p / 10)} D`, trap: 'power_of_ten', why: 'Convert centimeters to meters exactly: divide by 100.' },
      ]),
      tldr: `P = 1/f(m) = 1/${fmt(fcm / 100)} = ${fmt(p)} diopters.`,
      steps: steps(['Units', `${fcm} cm = ${fmt(fcm / 100)} m.`], ['Compute', `P = 1/${fmt(fcm / 100)} = ${fmt(p)} D.`]),
      takeaway: 'Lens power in diopters is 1/f with f in meters; diverging lenses are negative.',
    });
  }

  // 20. Decibels
  for (const factor of [10, 100, 1000, 10000]) {
    const db = 10 * log10(factor);
    make({
      type: 'waves_sound',
      kps: ['kp-mcat-decibels'],
      outline: { category: '4D', sirs: 2 },
      difficulty: 2,
      prompt: `The intensity of a sound increases by a factor of ${factor.toLocaleString('en-US')}. By how much does its sound level increase?`,
      options: options(4, { text: `${fmt(db)} dB`, why: `Δβ = 10 log(${factor.toLocaleString('en-US')}) = ${fmt(db)} dB.` }, [
        { text: `${fmt(log10(factor))} dB`, trap: 'skipped_step', why: 'That leaves out the factor of 10 in β = 10 log(I/I₀).' },
        { text: `${factor.toLocaleString('en-US')} dB`, trap: 'lookalike', why: 'Decibels are logarithmic, not proportional to intensity.' },
        { text: `${fmt(db * 2)} dB`, trap: 'power_of_ten', why: 'Each tenfold step adds 10 dB, not 20.' },
        { text: `${fmt(db + 10)} dB`, trap: 'skipped_step', why: 'Count the factors of 10 again: each one adds exactly 10 dB.' },
        { text: `${fmt(db / 2)} dB`, trap: 'skipped_step', why: 'Each tenfold step adds 10 dB, not 5.' },
      ]),
      tldr: `Each 10× in intensity adds 10 dB, so ×${factor.toLocaleString('en-US')} adds ${fmt(db)} dB.`,
      steps: steps(['Formula', 'β = 10 log(I/I₀).'], ['Compute', `10 × log(${factor.toLocaleString('en-US')}) = 10 × ${fmt(log10(factor))} = ${fmt(db)} dB.`]),
      takeaway: 'Sound level is logarithmic: +10 dB per tenfold increase in intensity.',
    });
  }

  // 21. Half-life
  for (const [total, half, unit, start] of [
    [24, 6, 'hours', null],
    [15, 5, 'days', null],
    [40, 10, 'minutes', null],
    [3, 1, 'years', 80],
  ]) {
    const n = total / half;
    const frac = 0.5 ** n;
    const ans = start ? `${fmt(start * frac)} g` : `${fmt(frac * 100, 2)}%`;
    make({
      type: 'nuclear',
      kps: ['kp-mcat-half-life'],
      outline: { category: '4E', sirs: 2 },
      difficulty: 2,
      prompt: start
        ? `A ${start} g sample of a radioactive isotope has a half-life of ${half} year${half === 1 ? '' : 's'}. How much remains after ${total} years?`
        : `A radioactive isotope has a half-life of ${half} ${unit}. What percentage of a sample remains after ${total} ${unit}?`,
      options: options(4, { text: ans, why: `${total}/${half} = ${fmt(n)} half-lives, so (½)^${fmt(n)} = ${fmt(frac, 4)} remains.` }, [
        { text: start ? `${fmt(start * (1 - frac))} g` : `${fmt((1 - frac) * 100, 2)}%`, trap: 'wrong_direction', why: 'That’s the amount that has decayed, not what remains.' },
        { text: start ? `${fmt(start / (n * 2))} g` : `${fmt(100 / (n * 2), 2)}%`, trap: 'lookalike', why: 'Decay is exponential: halve once per half-life rather than dividing by 2n.' },
        { text: start ? `${fmt(start * 0.5 ** (n - 1))} g` : `${fmt(0.5 ** (n - 1) * 100, 2)}%`, trap: 'skipped_step', why: `Count the half-lives again: ${total}/${half} = ${fmt(n)}.` },
        { text: start ? `${fmt(start * 0.5 ** (n + 1))} g` : `${fmt(0.5 ** (n + 1) * 100, 2)}%`, trap: 'skipped_step', why: `That’s one half-life too many: ${total}/${half} = ${fmt(n)}.` },
      ]),
      tldr: `${fmt(n)} half-lives → (½)^${fmt(n)} = ${fmt(frac, 4)} of the original.`,
      steps: steps(['Count', `${total} ÷ ${half} = ${fmt(n)} half-lives.`], ['Compute', `(½)^${fmt(n)} = ${fmt(frac, 4)}${start ? `, so ${start} g → ${fmt(start * frac)} g` : ` = ${fmt(frac * 100, 2)}%`}.`]),
      takeaway: 'Each half-life halves what’s left: 1 → ½ → ¼ → ⅛ → 1/16.',
    });
  }

  // 22. Standard cell potentials
  const halfCells = {
    Ag: ['Ag⁺/Ag', 0.8],
    Cu: ['Cu²⁺/Cu', 0.34],
    Zn: ['Zn²⁺/Zn', -0.76],
    Fe: ['Fe²⁺/Fe', -0.44],
    Ni: ['Ni²⁺/Ni', -0.25],
  };
  for (const [cat, an] of [
    ['Cu', 'Zn'],
    ['Ag', 'Cu'],
    ['Ag', 'Zn'],
    ['Cu', 'Fe'],
    ['Ni', 'Zn'],
  ]) {
    const [cl, ce] = halfCells[cat];
    const [al, ae] = halfCells[an];
    const e = ce - ae;
    const v = (x) => `${fixed(x, 2)} V`;
    make({
      type: 'electrochemistry',
      kps: ['kp-mcat-cell-potential', 'kp-mcat-galvanic'],
      outline: { category: '4C', sirs: 2 },
      difficulty: 2,
      prompt: `A galvanic cell is built from ${cl} and ${al} half-cells. The standard reduction potentials are ${cl}: ${fixed(ce, 2)} V and ${al}: ${fixed(ae, 2)} V. What is E°cell?`,
      options: options(4, { text: v(e), why: `${cl.split('/')[1]} is the cathode (higher E°): ${fixed(ce, 2)} − (${fixed(ae, 2)}) = ${fixed(e, 2)} V.` }, [
        { text: v(ce + ae), trap: 'sign_flip', why: 'That adds the reduction potentials. Subtract the anode’s from the cathode’s.' },
        { text: v(-e), trap: 'sign_flip', why: 'That subtracts in the wrong order. A galvanic cell has a positive E°cell.' },
        ...(cat === 'Ag' ? [{ text: v(2 * ce - ae), trap: 'lookalike', why: 'Potentials are intensive: don’t multiply by the 2 that balances electrons.' }] : []),
        { text: v(Math.abs(ce) + Math.abs(ae) + 0.1), trap: 'lookalike', why: 'Recompute E°(cathode) − E°(anode) with the signs given.' },
      ]),
      tldr: `E°cell = E°cathode − E°anode = ${fixed(ce, 2)} − (${fixed(ae, 2)}) = ${fixed(e, 2)} V.`,
      steps: steps(
        ['Assign', `The half-cell with the higher reduction potential (${cl}) is the cathode; ${al} is the anode.`],
        ['Compute', `${fixed(ce, 2)} − (${fixed(ae, 2)}) = ${fixed(e, 2)} V.`],
      ),
      takeaway: 'E°cell = E°red(cathode) − E°red(anode); a spontaneous (galvanic) cell is positive.',
    });
  }

  // 23. Spontaneity crossover temperature
  for (const [dh, ds] of [
    [30, 150],
    [-50, -100],
    [80, 200],
    [-60, -150],
  ]) {
    const t = (dh * 1000) / ds;
    const above = dh > 0;
    const range = (x) => `Only ${above ? 'above' : 'below'} ${fmt(x)} K`;
    make({
      type: 'thermodynamics',
      kps: ['kp-mcat-gibbs-temperature'],
      outline: { category: '5E', sirs: 2 },
      difficulty: 3,
      prompt: `A reaction has ΔH = ${dh > 0 ? '+' : '−'}${Math.abs(dh)} kJ/mol and ΔS = ${ds > 0 ? '+' : '−'}${Math.abs(ds)} J/(mol·K). Assuming both are constant, when is it spontaneous?`,
      options: options(4, { text: range(t), why: `ΔG = ΔH − TΔS < 0 ${above ? 'once TΔS exceeds ΔH' : 'while |TΔS| stays below |ΔH|'}: T ${above ? '>' : '<'} ${fmt(Math.abs(dh * 1000))}/${Math.abs(ds)} = ${fmt(t)} K.` }, [
        { text: `Only ${above ? 'below' : 'above'} ${fmt(t)} K`, trap: 'sign_flip', why: above ? 'With ΔH and ΔS both positive, high temperatures favor spontaneity.' : 'With ΔH and ΔS both negative, low temperatures favor spontaneity.' },
        { text: range(t / 1000), trap: 'power_of_ten', why: 'That divides kJ by J. Convert ΔH to joules first.' },
        { text: 'At all temperatures', trap: 'lookalike', why: 'That needs ΔH < 0 and ΔS > 0. Here the signs match, so there’s a crossover.' },
      ]),
      tldr: `T = ΔH/ΔS = ${fmt(Math.abs(dh * 1000))}/${Math.abs(ds)} = ${fmt(t)} K; spontaneous ${above ? 'above' : 'below'} it.`,
      steps: steps(
        ['Signs', above ? 'ΔH > 0 and ΔS > 0: spontaneous at high T.' : 'ΔH < 0 and ΔS < 0: spontaneous at low T.'],
        ['Crossover', `ΔG = 0 at T = ΔH/ΔS = ${fmt(Math.abs(dh * 1000))} J ÷ ${Math.abs(ds)} J/K = ${fmt(t)} K.`],
      ),
      takeaway: 'When ΔH and ΔS share a sign, temperature decides: the crossover is T = ΔH/ΔS (in matching units).',
    });
  }

  // 24. Rate laws
  for (const [law, change, factor] of [
    ['rate = k[A]²[B]', '[A] is doubled', 4],
    ['rate = k[A]²[B]', 'both [A] and [B] are doubled', 8],
    ['rate = k[A]²[B]', '[B] is tripled', 3],
    ['rate = k[A][B]²', '[B] is doubled', 4],
    ['rate = k[A][B]²', '[A] is halved', 0.5],
  ]) {
    const exps = law.includes('[A]²') ? { A: 2, B: 1 } : { A: 1, B: 2 };
    const linear = change.includes('both') ? 4 : change.includes('halved') ? 0.5 : change.includes('tripled') ? 3 : 2;
    const ffmt = (x) => `${fmt(x)}× the original rate`;
    make({
      type: 'kinetics_equilibrium',
      kps: ['kp-mcat-rate-law'],
      outline: { category: '5E', sirs: 2 },
      difficulty: 2,
      prompt: `A reaction follows ${law}. If ${change}, how does the rate change?`,
      options: options(4, { text: ffmt(factor), why: `Each concentration factor is raised to its order: the rate changes by ${fmt(factor)}×.` }, [
        { text: ffmt(linear), trap: 'skipped_step', why: 'That ignores the reaction orders. Raise each factor to its exponent.' },
        { text: ffmt(factor * 2), trap: 'lookalike', why: 'Recheck the exponents: multiply the factors, each raised to its order.' },
        { text: ffmt(factor === 1 ? 2 : 1), trap: 'false_fact', why: 'Changing a reactant that appears in the rate law changes the rate.' },
        { text: ffmt(factor * factor), trap: 'lookalike', why: 'That squares the overall change. Raise each concentration change to its own order.' },
        { text: ffmt(1 / factor), trap: 'wrong_direction', why: 'That inverts the change: higher concentrations speed the reaction, lower ones slow it.' },
      ]),
      tldr: `${law}: ${change} → rate × ${fmt(factor)}.`,
      steps: steps(['Orders', `A is order ${exps.A}; B is order ${exps.B}.`], ['Scale', `Multiply each change raised to its order: ${fmt(factor)}×.`]),
      takeaway: 'Rate changes by (concentration factor)^order for each reactant in the rate law.',
    });
  }

  // 25. Moles from mass
  for (const [name, formula, mass, mm] of [
    ['water', 'H₂O', 36, 18],
    ['carbon dioxide', 'CO₂', 88, 44],
    ['sodium chloride', 'NaCl', 117, 58.5],
    ['glucose', 'C₆H₁₂O₆', 90, 180],
    ['oxygen gas', 'O₂', 8, 32],
  ]) {
    const n = mass / mm;
    make({
      type: 'stoichiometry',
      kps: ['kp-mcat-moles'],
      outline: { category: '4E', sirs: 1 },
      difficulty: 1,
      prompt: `How many moles are in ${mass} g of ${name} (${formula}, molar mass ${fmt(mm, 1)} g/mol)?`,
      options: options(4, { text: `${fmt(n, 2)} mol`, why: `${mass} g ÷ ${fmt(mm, 1)} g/mol = ${fmt(n, 2)} mol.` }, [
        { text: `${fmt(mm / mass, 2)} mol`, trap: 'wrong_direction', why: 'That divides molar mass by mass. Moles = mass ÷ molar mass.' },
        { text: `${fmt(mass * mm)} mol`, trap: 'lookalike', why: 'Multiplying mass by molar mass gives g²/mol, not moles.' },
        { text: `${fmt(n * 2, 2)} mol`, trap: 'skipped_step', why: 'That doubles the answer. Recheck the division.' },
      ]),
      tldr: `n = m/M = ${mass}/${fmt(mm, 1)} = ${fmt(n, 2)} mol.`,
      steps: steps(['Formula', 'n = mass ÷ molar mass.'], ['Compute', `${mass} ÷ ${fmt(mm, 1)} = ${fmt(n, 2)} mol.`]),
      takeaway: 'Grams to moles: divide by molar mass.',
    });
  }

  // 26. Oscillation periods
  const osc = [
    ['simple pendulum', 'its length is made four times longer', '2×', 'T ∝ √L, and √4 = 2.', [
      ['4×', 'skipped_step', 'Take the square root: T ∝ √L.'],
      ['0.5×', 'wrong_direction', 'A longer pendulum swings more slowly, so T grows.'],
      ['1× (unchanged)', 'false_fact', 'Length does set a pendulum’s period.'],
    ]],
    ['simple pendulum', 'its length is made nine times longer', '3×', 'T ∝ √L, and √9 = 3.', [
      ['9×', 'skipped_step', 'Take the square root: T ∝ √L.'],
      ['1/3×', 'wrong_direction', 'A longer pendulum swings more slowly, so T grows.'],
      ['1× (unchanged)', 'false_fact', 'Length does set a pendulum’s period.'],
    ]],
    ['mass on a spring', 'the mass is quadrupled', '2×', 'T ∝ √m, and √4 = 2.', [
      ['4×', 'skipped_step', 'Take the square root: T ∝ √m.'],
      ['0.5×', 'wrong_direction', 'More mass oscillates more slowly, so T grows.'],
      ['1× (unchanged)', 'lookalike', 'Mass doesn’t matter for a pendulum, but it does for a spring.'],
    ]],
    ['mass on a spring', 'the spring constant is quadrupled', '0.5×', 'T ∝ 1/√k, so 4× the stiffness halves T.', [
      ['2×', 'wrong_direction', 'A stiffer spring oscillates faster, so T shrinks.'],
      ['0.25×', 'skipped_step', 'Take the square root: T ∝ 1/√k.'],
      ['4×', 'wrong_direction', 'A stiffer spring oscillates faster, so T shrinks.'],
    ]],
    ['simple pendulum', 'its bob’s mass is doubled', '1× (unchanged)', 'A pendulum’s period doesn’t depend on mass: T = 2π√(L/g).', [
      ['√2×', 'lookalike', 'That’s the spring rule. A pendulum’s period is independent of mass.'],
      ['2×', 'false_fact', 'Mass doesn’t appear in T = 2π√(L/g).'],
      ['0.5×', 'false_fact', 'Mass doesn’t appear in T = 2π√(L/g).'],
    ]],
  ];
  for (const [system, change, factor, why, ds] of osc) {
    const isPend = system.includes('pendulum');
    make({
      type: 'waves_sound',
      kps: ['kp-mcat-oscillation'],
      outline: { sirs: 2 },
      difficulty: 2,
      prompt: `A ${system} oscillates with period T. If ${change}, what is the new period?`,
      options: options(4, { text: factor, why }, ds.map(([text, trap, w]) => ({ text, trap, why: w }))),
      tldr: isPend ? 'Pendulum: T = 2π√(L/g), independent of mass.' : 'Spring: T = 2π√(m/k).',
      steps: steps(['Formula', isPend ? 'T = 2π√(L/g).' : 'T = 2π√(m/k).'], ['Scale', why]),
      takeaway: 'Pendulum period depends only on length (and g); a spring’s depends on m/k.',
    });
  }
}
