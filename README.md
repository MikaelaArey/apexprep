# ApexPrep

MCAT and LSAT practice built for two-minute gaps. An iPhone app (Expo / React
Native) with a Daily 5, Quick Drills, passage sets, spaced review that plans around
the test date, streaks, stats, and explanations for every answer choice. It works
fully offline; accounts and backup run on Supabase.

The game layer:

- **The Climb:** each section from easiest to hardest, ten questions a floor.
- **Ranked bank:** every question with its difficulty level, from Warm-up to Boss.
- **Badges:** 26 tiered badges.
- **Sprout:** a study buddy who cheers combos and comebacks and grows as you level
  up. It can be turned off and stays hidden in Pure Study.
- **Score history:** official and practice test scores, charted against your goal.

## Run it

```bash
npm install
npx expo start --ios        # opens in Expo Go on the simulator
npm run ios:native          # full native build (needs Xcode + CocoaPods)
```

The native build is needed for Sign in with Apple and real notifications. On this
Mac, Xcode isn't the active developer directory, so prefix commands with
`DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` (or run
`sudo xcode-select -s /Applications/Xcode.app` once).

## Turn on accounts and backup (Supabase)

Without keys the app runs offline and never syncs. To connect it, follow
[docs/SUPABASE.md](docs/SUPABASE.md): create the project, run
`supabase/schema.sql`, switch on anonymous sign-ins, and put the URL and
publishable key in `.env.local` (see `.env.example`).

## How it's organized

| Path | What's there |
|---|---|
| `content/` | The question bank, as YAML. Edit here, then `npm run content`. Files ending in `-gen.yaml` are generated. |
| `scripts/item-models/` | Code that generates questions: MCAT calculations, concept sets and LSAT formal logic. |
| `src/content/` | Taxonomy (sections, question types, trap labels) and the compiled packs. |
| `src/engine/` | Pure logic: streaks, XP, mastery, FSRS-6 spaced review, session building, stats, difficulty levels, the Climb, badges, scores and Sprout's lines. |
| `src/data/` | On-device SQLite storage (the source of truth). |
| `src/state/` | App store and derived data (streak, due reviews, today's plan). |
| `src/sync/` | Supabase sync engine and accounts. |
| `src/app/` | Screens (Expo Router). `src/session/` holds the study-session screens; `src/ui/` holds shared pieces such as Sprout, confetti and badge medals. |
| `supabase/` | Database schema, and a local stand-in for testing sync. |
| `.maestro/` | UI flows that drive the app in the simulator. |

## Questions

The bank has 1,037 MCAT questions and 256 LSAT questions. All are original
practice items written for ApexPrep, not official AAMC or LSAC content. Every
item still needs review by a top scorer before it's marked `status: live`.

- How to write questions: [docs/CONTENT.md](docs/CONTENT.md).
- Where the questions come from, how they were checked and what an expert should
  review first: [docs/CONTENT-REVIEW.md](docs/CONTENT-REVIEW.md).

```bash
npm run items               # regenerate the *-gen.yaml files from scripts/item-models/
npm run content             # validate, rank by difficulty and compile into the app's packs
```

## Tests

```bash
npm test                    # unit tests: engine, game layer, and a check of every question
npm run test:sync           # sync engine against a local Postgres + PostgREST stand-in
npm run typecheck && npx eslint .
```

UI flows (simulator must be booted and the dev server running):

```bash
maestro test .maestro/onboarding.yaml .maestro/daily5.yaml .maestro/tour.yaml   # Expo Go
maestro test .maestro/native/                                                   # native build
```

The dev-only link `apexprep://dev-reset?onboarded=1&exam=LSAT&demo=1` resets the
app and loads three weeks of demo history; Settings → Developer has the same
tools. None of it ships in release builds.

## Regenerating the icon

```bash
python3 -m pip install pillow && python3 scripts/make-icons.py
```
