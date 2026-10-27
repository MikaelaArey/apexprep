# Writing ApexPrep questions

Questions live in `content/<exam>/<section>.yaml` and compile into the app with
`npm run content`, which validates every item and refuses to write anything if
one is broken. Files by section: `lsat/lr.yaml`, `lsat/rc.yaml`, `mcat/cp.yaml`,
`mcat/cars.yaml`, `mcat/bb.yaml`, `mcat/ps.yaml`.

All questions must be original. Never copy or paraphrase AAMC or LSAC questions.

## A question

```yaml
- id: lsat-lr-0025            # exam-section-number, never reused
  type: weaken                # question type or MCAT topic (taxonomy.json → types)
  family: argument_evaluation # LSAT family / MCAT discipline / CARS skill
  kps: [kp-lsat-rival-cause]  # knowledge points it tests (knowledge-points.yaml)
  outline: { category: 1A, sirs: 2 }   # MCAT only: AAMC content category and skill
  difficulty: 3               # 1–5
  stimulus: >-                # LR arguments; omit for passage questions
    ...
  prompt: Which one of the following, if true, most seriously weakens the argument?
  options:                    # LSAT 5, MCAT 4; ids A–E are assigned in order
    - text: ...
      trap: out_of_scope      # every wrong answer gets a trap (taxonomy.json → traps)
      why: One or two sentences on why it's wrong.
    - text: ...
      correct: true           # exactly one
      why: Why it's right.
  tldr: The whole idea in 25 words or fewer.
  steps:                      # 2–6 steps, each 40 words or fewer
    - label: Task
      body: ...
  takeaway: The reusable rule. It becomes the concept card's lesson.
  siblings: [lsat-lr-0002]    # questions on the same idea, used for re-tests
```

Passage sets wrap their questions:

```yaml
- passage:
    id: mcat-bb-p02
    title: ...
    domain: biochemistry
    mini: true                # phone-sized format: 150–250 words, 2–3 questions
    paragraphs: [...]
    table: { caption: ..., columns: [...], rows: [[...]] }
  items:
    - id: mcat-bb-0012
      ...
```

## Style rules the validator checks

- Exactly one correct option, and the right number of options for the exam.
- Every wrong option has a known trap tag; the correct one has none.
- `tldr` 25 words or fewer, steps 40 or fewer, rationales 30 or fewer (warnings).
- Every knowledge point and sibling exists, and siblings share a knowledge point.
- YAML gotcha: a one-line value containing ": " must be folded (`>-`) or quoted.
  `python3 scripts/fix-yaml-colons.py content/**/*.yaml` fixes that automatically.

## Review before "live"

New items default to `status: review`. Before launch, every item needs:

1. A check by a top scorer (515+ MCAT or 170+ LSAT) for accuracy and fairness.
2. A second reviewer with a source for every factual claim.
3. After launch, item analysis from real answers: rework items that don't separate
   strong from weak students, and distractors almost nobody picks.

## Concept cards

Each knowledge point in `knowledge-points.yaml` becomes a spaced-review card:
`front` is the prompt and `back` is the answer. Missing a question (or answering
unsure) adds its knowledge points to the student's review deck.
