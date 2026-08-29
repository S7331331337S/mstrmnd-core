# MSTRMND Board

A mastermind board that argues. You put a decision in front of it; seven specialists
take positions, tear into each other's reasoning, and a chair closes the room with a
call and three things to do this week.

Built with Expo SDK 57, Expo Router, and Reanimated 4. Runs on iOS, Android and web.

## Provenance

Extracted from [`S7331331337S/skills`](https://github.com/S7331331337S/skills)
(`apps/mstrmnd`, commit `a74d2c9`) into `mstrmnd-core/apps/board`. Source files
match that commit (path rewrite `apps/mstrmnd` → `apps/board` only). A
`git filter-repo` replay is ready locally if a git-capable push is available
to replace this API-uploaded branch with first-class history.

This is the decision-room product — not Alliance (agent companion) and not the
profiles/bookings marketplace. Keep it independent until a later, verified merge.

The Expo skills fork should stay untouched until this app is verified here. Do
not reset that fork until Board typecheck, tests, and a demo run succeed in
this repo.

## Why it works

Most AI advice collapses into one agreeable voice. This app's members are each
constrained to a single lens and prompted to take a position and name who they're
disagreeing with — the disagreement is the product. The Chair never debates; it only
rules.

| Member | Lens |
| --- | --- |
| The Architect | Feasibility, dependencies, failure modes |
| The Operator | Sequencing, ownership, what ships Monday |
| The Closer | Demand, pricing, who actually pays |
| The Contrarian | The strongest argument against |
| The Visionary | Ambition, the 10x version, category |
| The Quant | Unit economics, payback, expected value |
| The Storyteller | Positioning, the one-line version |
| **The Chair** | Synthesis — always seated, closes every room |

A deliberation runs in three phases: **openings** (each member in seat order),
**crossfire** (each member responds to someone else by name), then the **ruling**.
Set "Quick round" in Settings to skip crossfire.

## Running it

From the monorepo root:

```bash
pnpm board         # expo start — then press i / a, or scan with Expo Go
pnpm board:web     # browser
```

Or from this directory (isolated npm lockfile, not the root pnpm workspace):

```bash
bash scripts/materialize-vendor.sh   # lockfile + PNG assets
npm ci
npm start          # then press i / a, or scan with Expo Go
npm run web        # browser
```

`package-lock.json` and `assets/*.png` are fetched from the pinned skills
commit (`a74d2c9`) by `scripts/materialize-vendor.sh`. Run that before
`npm ci` on a fresh checkout. Once a git-capable push lands those files in
this repo, the script can be removed.

Checks (from repo root or this directory):

```bash
pnpm board:typecheck   # tsc, strict
pnpm board:test        # bun test — SSE stream decoding
pnpm board:export      # full Metro bundle; catches import errors tsc can't
```

## The two engines

**Offline board (default).** With no OS session the app runs scripted stand-ins. Every
screen, animation and the whole session flow work without a network — it's how the
app demos. These lines are written to show *how each member thinks*; they cannot
reason about your actual question, and the ruling says so.

**Hosted.** Sign in to MSTRMND OS in Settings. The same board streams through
`POST /api/board/complete`. The client sends a quality hint (`fast` /
`balanced` / `capable`); the host picks the model. No vendor API key lives on
the device.

```bash
# Terminal 1 — OS (default port 3000; Board defaults to 3001)
cd mstrmnd-os && AUTH_SECRET=dev pnpm dev -- --port 3001

# Terminal 2 — Board
pnpm board:web
```

Set `EXPO_PUBLIC_MSTRMND_API_URL` if the host is not `http://localhost:3001`.
Create an OS account on `/sign-up`, then connect with that email and password
in Board Settings.

### Hosted routing

- Session JWT is stored in the device keychain (`expo-secure-store`), or
  `localStorage` on web, and is only sent to the configured OS base URL.
- OS enforces auth, prompt size, and a per-workspace daily request budget
  (`BOARD_DAILY_REQUEST_LIMIT`, default 200). Completions are appended to
  `.mstrmnd/board-audit.jsonl`. The budget ledger is file-backed
  (`.mstrmnd/board-budget.json`) — it persists on a mounted volume, not on
  ephemeral Vercel serverless instances.
- `EngineKind` is `"hosted" | "demo"`. Concrete model ids stay in OS env
  (`MSTRMND_MODEL`, `MSTRMND_MODEL_FAST`, `MSTRMND_MODEL_CAPABLE`).
- The offline demo provider stays for tests and demos.

Streaming uses `expo/fetch`, not the global `fetch` — React Native's built-in fetch
is XHR-backed and exposes no `response.body`, so token streaming is impossible
through it.

## Layout

```
src/
  app/                    # Expo Router routes only
    (tabs)/               #   Table · History · Board · Settings
    room/[id].tsx         #   the live deliberation
    agent/[id].tsx        #   member detail (modal)
  agents/
    roster.ts             # personas, system prompts, preset tables
    deliberation.ts       # round orchestration
    providers/            # hosted · offline · SSE decoder (+ tests)
  components/             # shared UI primitives
  screens/                # screen bodies + their private parts
  lib/                    # stores, types
  theme/                  # tokens: color, spacing, type, motion…
```

Follows Expo project-structure and design-system conventions: routes stay
route-only, screen bodies live in `screens/`, and every repeated visual value is
a token in `src/theme/`.

Later, after the app runs intact here, extract shared layers into packages
(`deliberation`, `agent-roster`, `model-router`, `design-tokens`). Do not split
those out in this import.

## Notes

- Sessions are stored on-device only (AsyncStorage, capped at 50). Nothing is
  uploaded. "Delete all sessions" in Settings clears them.
- The room stops cleanly if you navigate away mid-deliberation, and one member
  failing doesn't abort the rest of the board.
- **Monochrome by design — there is no hue anywhere, including for status.**
  Three rules carry everything the color used to:
  - **Identity** is the monogram and the name. Members have no assigned color.
  - **State** is fill vs outline — an active element is ink-filled, an inactive
    one is a hairline circle. That reads faster than a hue change and survives
    being printed or screenshotted in greyscale.
  - **Depth** is a hairline plus a light shadow, or a soft gradient wash. The
    page is lit from above; inverting that wash reads as a dirty page.
- The Chair's ruling inverts to solid ink. With no accent to escalate to, that
  flip is the strongest emphasis in the system, and it's reserved for the verdict.
- One typeface (Inter), with optical tracking per size — negative on display
  sizes, positive on small caps. That's most of what separates type that looks
  considered from type that looks defaulted.
- The palette is static rather than platform-semantic, so the same values can
  feed Reanimated styles and gradients.
