# MSTRMND Mobile

The MSTRMND Agent Alliance, in your pocket. A React Native + Expo client for
conversing with the personal intelligence layer — chat with Hermes and the
rest of the alliance, browse the memory graph, and manage your identity —
built to ship to iOS and the web from one codebase.

## Stack

- **Expo Router** (file-based routing, universal — native + web, including
  server API routes)
- **NativeWind + Tailwind** for styling, with a CSS-variable token system
  that mirrors the web brand (`src/global.css`, `tailwind.config.js`)
- **React Native Reanimated + Gesture Handler** for motion (press states,
  the bottom sheet, the segmented control's sliding indicator)
- **expo-blur** for the translucent glass surfaces (tab bar, headers,
  composer, sheets)
- **Vercel AI SDK** (`ai` + `@ai-sdk/react`) for the chat pipeline —
  `useChat` on the client, `streamText` in an Expo Router API route on the
  server

## Getting started

```bash
pnpm install
pnpm --filter @mstrmnd/mobile dev   # or: pnpm mobile
```

Then press `w` for web, `i` for iOS simulator, or scan the QR code with
Expo Go / a dev client.

The chat screen works immediately with **no API key** — the server falls
back to an in-process mock model (see "Connecting a live model" below) so
the whole alliance is interactive out of the box.

## Design system

Everything under `src/theme/` and `src/components/ui/` is the design
system; screens (`src/app/`) and feature components (`src/components/chat`,
`src/components/agents`, `src/components/memory`) are built entirely out of
those primitives.

### Tokens

- **`src/global.css`** — semantic CSS custom properties (`--background`,
  `--foreground`, `--accent`, `--line`, …), one block for light (`:root`),
  one for system-dark (`@media (prefers-color-scheme: dark)`), one for the
  manual dark override (`.dark`). This is the same architecture as the web
  dashboard's `globals.css`.
- **`src/theme/tokens.ts`** — raw primitives (hex palette, radii, spacing,
  motion curves, blur intensities) for the handful of places that need a
  real JS value instead of a className (BlurView tint, LinearGradient
  stops, shadow colors).
- **`src/theme/theme.ts`** — resolved `darkTheme` / `lightTheme` objects,
  plus `themeCssVars()`, which is applied at the app root via NativeWind's
  `vars()` API. CSS `.dark` / `prefers-color-scheme` selectors alone can't
  express "force light while the system is dark" reliably across native +
  web, so the *authoritative* scheme is resolved in JS
  (`useAppColorScheme`) and injected as inline vars — the CSS blocks are
  just the pre-hydration fallback.
- **`tailwind.config.js`** — maps those CSS variables into Tailwind color
  utilities (`bg-background`, `text-foreground`, `border-line/60`, …) using
  the `rgb(var(--x) / <alpha-value>)` pattern so opacity modifiers work.

### The one-accent rule

Same invariant as the brand overall: **grayscale everywhere, one accent**.
The accent *inverts* with theme instead of staying fixed — Platinum
`#e8e2d0` lifts off Obsidian `#0a0a0b` in dark mode; a near-black Ink
`#131311` grounds Paper `#faf9f6` in light mode. Status colors (amber/red)
are reserved for warnings and destructive actions only, never decoration.

### Primitives (`src/components/ui`)

`Text` / `Label`, `Button` / `IconButton`, `Card`, `Divider` (a true
0.5px hairline via `border-[0.5px]`), `Badge`, `Avatar`, `StatusDot`
(brand's breathing pulse), `TextField`, `SegmentedControl`, `Sheet` (a
from-scratch bottom sheet — deliberately not built on RN's `Modal`, which
renders inconsistently on react-native-web), `GlassSurface` (the blur
wrapper), `PressableScale` (the shared press-feedback animation every
interactive element uses), `TypingDots`, `EmptyState`.

Radii step from `xs` (3px — the brand's exact architectural radius, used
for badges/tags) up through `xl` (20px, on the bottom sheet), deliberately
tighter than typical consumer chat-app rounding.

## The alliance

`src/lib/agents.ts` defines the roster surfaced in the Alliance tab —
Hermes (orchestrator), Archivist (memory graph), Vision (multimodal),
Atelier (creative) — mapped to the repo's own "Core Systems". Each agent
has a system prompt and a demo-mode reply template; switching agents in
the Chat tab's picker swaps `useChat`'s `id`, so each agent keeps its own
history via the AI SDK's chat store.

## Connecting a live model

Set `AI_GATEWAY_API_KEY` (a [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
key) as an environment variable — locally in `.env.local`, or as a Cloud
Agent / EAS secret. `src/app/api/chat+api.ts` picks it up automatically and
switches every agent from the mock model to `streamText` against a real
model (default `anthropic/claude-sonnet-4.5`, override via
`EXPO_PUBLIC_MSTRMND_MODEL`). No other code changes needed — both paths run
through the same `streamText` → `toUIMessageStream` →
`createUIMessageStreamResponse` pipeline.

For native release builds, the app can't run its own API route — set
`EXPO_PUBLIC_API_BASE_URL` to wherever the Expo Router server output is
deployed (EAS Hosting, or `expo export -p web` behind `@expo/server`).

## Memory + identity

The Memory and Settings tabs currently read from local fixtures
(`src/lib/memory.ts`, `src/lib/identity.ts`) shaped exactly like
`@mstrmnd/schemas`' `MemoryNode` / `IdentityModel` and `templates/identity.md`.
Swap them for real calls into `@mstrmnd/mcp-server`'s `search_memory` /
`get_identity` tools once the mobile client talks to a running Hermes
instance.

## Project layout

```
src/
  app/                  expo-router screens (+ api/chat+api.ts)
  components/
    ui/                 design-system primitives
    chat/               message list, bubbles, composer, agent switcher
    agents/             alliance roster card
    memory/             memory-graph node card
    layout/             Screen wrapper
  theme/                tokens, theme objects, ThemeProvider, fonts
  lib/                  agents/memory/identity data, AI SDK wiring, utils
  hooks/                color-scheme hook (persists Obsidian/Paper/System)
```
