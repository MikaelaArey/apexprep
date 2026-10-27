# Question bank: sources and review status

This explains where ApexPrep's questions come from, how each kind was checked and
what still needs a human expert. Every question in the app is still marked
`status: review`. None has been approved by a human expert yet.

## Why there are no official questions

- **AAMC (MCAT):** the terms of use forbid copying AAMC materials or making
  derivative works from them, including for AI or machine-learning use. Students
  should still take the official AAMC practice exams. They can log those scores
  in ApexPrep's score history.
- **LSAC (LSAT):** real LSAT questions require an LSAC license, and each student
  would also need a LawHub Advantage subscription.

Everything in `content/` is original. Never paste in or paraphrase official
questions.

## The MCAT bank (1,037 questions)

| Source | B/B | C/P | P/S | CARS | Total |
|---|---:|---:|---:|---:|---:|
| Written by hand | 31 | 25 | 23 | 130 | 209 |
| Computed calculations (`scripts/item-models/{bb,cp,ps}.mjs`) | 47 | 121 | 31 | — | 199 |
| Concept sets (`scripts/item-models/concepts-*.mjs`) | 262 | 155 | 212 | — | 629 |
| **Total** | **340** | **301** | **266** | **130** | **1,037** |

There are 40 passages: 26 CARS passages and 14 science passages built around
experiments, with tables. All of their data are invented, although the
phenomena are real. The LSAT bank has 256 questions. LSAT work is paused while
the MCAT is the focus.

## How each kind was checked

All of this checking was done by Claude (an AI) and by automated tests. None of
it is a substitute for review by a top scorer or a subject expert.

**Computed calculations.** The correct answer is computed in code. Each wrong
option comes from a named mistake, such as leaving out the ½ in ½CV², inverting
a ratio, or slipping a power of ten. Its explanation describes that mistake, so
it is true by construction. The generator skips duplicate options and refuses to
write a question that runs out of distinct ones.

**Concept sets.** A short scenario points to one term in a family of look-alike
terms, for example SN1, SN2, E1 and E2. The wrong options are other terms from
the same family, and each one is explained by its definition. Where a second
term could also be defended as the answer, it is excluded from that question's
options (the set's `not` list).

**Hand-written questions.** Claude wrote each one and then re-read it against
the passage and standard textbook facts. Facts were checked from Claude's own
knowledge. There are no per-item source citations yet.

**Automated checks on every build** (`npm run content`, `npm test`):

- There is exactly one correct answer, every wrong answer has a trap label, and
  every knowledge point exists.
- No explanation refers to an answer letter, because answer order is shuffled.
- Near-duplicate questions are flagged.
- The build reports where correct answers fall. It is currently A 23%, B 26%,
  C 26%, D 25% overall, and A 23%, B 26%, C 27%, D 23% on numeric questions.
- Unit tests check every compiled question: the right number of options, one
  correct answer, an explanation for every option, valid knowledge points, and
  passages linked to their questions.

## Fact-check log

**The original 66 questions (34 LSAT, 32 MCAT):**

- **LSAT:** three explanations named answer letters, or used A/B/C as logic
  symbols that read like answer letters. They were fixed when answer shuffling
  arrived. A full factual re-check of the 34 LSAT originals is still to do.
- **MCAT, re-checked 27 Oct 2026:** every answer key and every calculation was
  re-derived. This included the enzyme-inhibition table, where the values fit
  Km = 1 mM, Vmax ≈ 100 µM/min and an apparent Km of 2 mM with the inhibitor. No
  errors were found. One tag was changed: `mcat-cars-0003` now uses the
  inference knowledge point.

**Fixes made while writing later batches:**

- **`mcat-bb-0027`:** a wrong answer said black-bodied, vestigial-winged flies
  can't undergo crossing over. Male fruit flies really don't, so the option could
  have been true. It was replaced.
- **`mcat-cp-0024`:** the critical-angle question gave sin 42° in the prompt,
  which gave away the answer. It now gives sin 45° for estimating.
- **`mcat-ps-6604`, `mcat-ps-6606`, `mcat-cp-6556`:** these concept questions
  each had a wrong option that could be argued for. The arguable options were
  "self-fulfilling prophecy" for stereotype threat, "in-group bias" for
  ethnocentrism and "surface tension" for capillary rise. Each is now excluded
  from that question.
- **`mcat-cp-6552`:** a garden-hose example for the continuity equation was
  replaced with blood slowing in the capillaries. Why a partly covered hose
  speeds up is really a pressure question, so the example was contestable.
- **Numeric answers:** answers are sorted, and the usual wrong answers sit on
  either side of the correct value. So the correct answer was B or C 76% of the
  time (D only 9%). The item models now offer more wrong answers, and each
  question takes whichever answer slot has been used least. Numeric answers are
  now spread across A–D.

## Difficulty ranking

Within each section, the build ranks every question from easiest (rank 1) to
hardest and gives it a level:

| Level | Share of the section |
|---|---|
| Warm-up | easiest 20% |
| Easy | next 25% |
| Medium | next 25% |
| Hard | next 20% |
| Boss | hardest 10% |

The 1–5 rating behind the rank comes from a rubric in
`scripts/build-content.mjs`:

- the author's 1–5 difficulty
- the number of solution steps in calculations
- the reading load of the prompt and options
- passage questions versus stand-alone questions
- how many wrong answers are subtle traps

These are estimates. Once real students answer the questions, ratings should be
recalibrated from the share who get each question right and from how well it
separates strong students from weak ones.

## Before launch: what an expert should check first

1. **CARS passages that make real historical claims.** These include Kafka and
   Brod, Fermat's margin note, Lamb and Coleridge, Mercator and Peters, Ariès,
   Modern Hebrew and default organ-donor consent. Each claim should be checked
   against a source.
2. **Science passages.** The data are invented. Check that each table is
   realistic and that every conclusion follows from it.
3. **Concept sets.** Look for any remaining case where a look-alike term could
   also be defended as the answer.
4. **Boss-level questions.** The hardest 10% are where a flawed question does
   the most damage to a student's confidence.

The review steps in [CONTENT.md](CONTENT.md#review-before-live) still apply:

1. A top scorer (515+ on the MCAT) checks each question.
2. A second reviewer adds a source for every factual claim.
3. After launch, item analysis from real answers flags weak questions.
