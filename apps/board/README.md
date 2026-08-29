# MSTRMND Board

A mastermind board that argues. You put a decision in front of it; seven specialists
take positions, tear into each other's reasoning, and a chair closes the room with a
call and three things to do this week.

Built with Expo SDK 57, Expo Router, and Reanimated 4. Runs on iOS, Android and web.

## Provenance

Extracted from [`S7331331337S/skills`](https://github.com/S7331331337S/skills)
(`apps/mstrmnd`, commit `a74d2c9`) into `mstrmnd-core/apps/board`. The original
author commit is preserved via `git filter-repo` (path rewrite only).

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
npm ci
npm start          # then press i / a, or scan with Expo Go
npm run web        # browser
```

Checks (from repo root or this directory):

```bash
pnpm board:typecheck   # tsc, strict
pnpm board:test        # bun test — SSE stream decoding
pnpm board:export      # full Metro bundle; catches import errors tsc can't
```

## The two engines

**Offline board (default).** With no API key the app runs scripted stand-ins. Every
screen, animation and the whole session flow work without a network — it's how the
app demos. These lines are written to show *how each member thinks*; they cannot
reason about your actual question, and the ruling says so.

**Claude.** Add a key in Settings and the same board runs against the Messages API,
streaming token by token. Model and debate depth are configurable.

### Bringing your own key

The app calls `api.anthropic.com` directly from the device. That's the right shape
for a personal tool and the wrong shape for a shipped product:

- The key is stored in the device keychain (`expo-secure-store`), or `localStorage`
  on web, and is only ever sent to Anthropic.
- Anyone with the app binary and device access can extract it.
- Before distributing this, route model calls through `mstrmnd-os` (usage, policy,
  audit, budget). Do not ship user Anthropic keys in the mobile binary.
- Replace `EngineKind = "claude" | "demo"` with a model-agnostic provider id.
- Keep the offline demo provider for tests and demos.
- The provider interface in `src/lib/types.ts` is the seam that has to change.

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
    providers/            # claude · offline · SSE decoder (+ tests)
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
