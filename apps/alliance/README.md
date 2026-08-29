# MSTRMND Alliance

The private AI companion for MSTRMND OS. Alliance provides direct access to
Hermes and specialist agents, personal memory, and identity context across iOS,
Android, and web.

It is intentionally separate from:

- `apps/board` — a focused multi-agent decision room.
- `apps/mobile` — the future customer-facing professional profiles, bookings,
  and mastermind-groups platform.

## What was consolidated

This app preserves the operational foundation from
`S7331331337S/mstrmnd-alliance`:

- Host-agnostic MSTRMND OS/Eve client
- Durable sessions and NDJSON streaming
- Complete Expo/EAS configuration and native assets
- Offline demo behavior

It incorporates the stronger interface system from
`S7331331337S/mstrmnd-mobile`:

- Obsidian/Platinum and Paper/Ink themes
- Inter + IBM Plex Mono typography
- CSS-variable NativeWind tokens
- Glass surfaces, restrained motion, haptics, and shared primitives
- Per-agent conversation histories

The standalone AI SDK API route was deliberately not imported. All live model,
memory, policy, audit, and budget operations belong behind MSTRMND OS.

## Run

From the `mstrmnd-core` root:

```bash
pnpm install
pnpm --filter @mstrmnd/alliance start
```

Press `w` for web, `i` for iOS, or `a` for Android.

## Connect MSTRMND OS

```bash
cp apps/alliance/.env.example apps/alliance/.env.local
# EXPO_PUBLIC_MSTRMND_API_URL=https://os.mstrmnd.example
```

Unset, Alliance stays in demo mode. When configured, `lib/agent-client.ts`
creates and resumes Eve sessions, streams NDJSON turns through `expo/fetch`,
and cancels in-flight work against the same configured origin.

## Verify

```bash
pnpm --filter @mstrmnd/alliance typecheck
pnpm --filter @mstrmnd/alliance lint
pnpm --filter @mstrmnd/alliance export:web
```

## Structure

```text
app/                  Expo Router routes: Chat, Alliance, Memory, Settings
components/
  ui/                 Theme-aware primitives
  chat/               Header, transcript, composer, agent switcher
  agents/             Agent roster presentation
  memory/             Memory-node presentation
hooks/                Persisted Paper/Obsidian/System preference
theme/                Tokens, typography, semantic themes, motion
lib/
  agent-client.ts     MSTRMND OS/Eve transport
  config.ts           Configured backend origin
  use-agent-chat.ts   Per-agent conversations over the OS transport
  agents.ts           Alliance roster and demo behavior
  memory.ts           Demo fixtures pending authenticated OS endpoint
  identity.ts         Demo fixtures pending shared account endpoint
```
