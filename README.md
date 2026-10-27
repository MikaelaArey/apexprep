# ApexPrep

MCAT and LSAT practice built for two-minute gaps. An iPhone app (Expo / React
Native) with a Daily 5, Quick Drills, passage sets, spaced review that plans around
the test date, streaks, stats, and explanations for every answer choice. It works
fully offline; accounts and backup run on Supabase.

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
| `content/` | The question bank, as YAML. Edit here, then `npm run content`. |
| `src/content/` | Taxonomy (sections, question types, trap labels) and the compiled packs. |
| `src/engine/` | Pure logic: streaks, XP, mastery, FSRS-6 spaced review, session building, stats. |
| `src/data/` | On-device SQLite storage (the source of truth). |
| `src/state/` | App store and derived data (streak, due reviews, today's plan). |
| `src/sync/` | Supabase sync engine and accounts. |
| `src/app/` | Screens (Expo Router). `src/session/` holds the study-session screens. |
| `supabase/` | Database schema, and a local stand-in for testing sync. |
| `.maestro/` | UI flows that drive the app in the simulator. |

## Questions

All questions are original practice items written for ApexPrep, not official
AAMC or LSAC content. Every item still needs review by a top scorer before it's
marked `status: live`. The authoring guide is [docs/CONTENT.md](docs/CONTENT.md).

```bash
npm run content             # validate and compile content/ into the app's packs
```

## Tests

```bash
npm test                    # unit tests: engine, content integrity (102 tests)
npm run test:sync           # sync engine against a local Postgres + PostgREST stand-in
npm run typecheck && npx eslint .
```

UI flows (simulator must be booted and the dev server running):

```bash
maestro test .maestro/onboarding.yaml .maestro/daily5.yaml .maestro/tour.yaml   # Expo Go
maestro test .maestro/native/first-run.yaml .maestro/native/review.yaml        # native build
```

The dev-only link `apexprep://dev-reset?onboarded=1&exam=LSAT&demo=1` resets the
app and loads three weeks of demo history; Settings → Developer has the same
tools. None of it ships in release builds.

## Regenerating the icon

```bash
python3 -m pip install pillow && python3 scripts/make-icons.py
```
