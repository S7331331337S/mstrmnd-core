# MSTRMND OS — self-hosted container image.
#
# The same source that deploys to Vercel builds two plain Node servers here:
#
#   1. `eve build`  → .output/server/index.mjs — the agent runtime (Nitro),
#      bound to loopback on EVE_NEXT_PRODUCTION_PORT.
#   2. `next build` → .next/standalone/server.js — the UI, which proxies
#      /eve/v1/* to (1). `withEve` bakes that loopback destination into the
#      production route manifest when the build is not running on Vercel.
#
# The result runs on ECS, Cloud Run, Fly, Railway, Kubernetes, or a single VPS
# with no platform APIs involved.
#
#   docker build -t mstrmnd-os .
#   docker run -p 3000:3000 --env-file .env -v mstrmnd-eve:/app/.eve mstrmnd-os
#
# See docs/portability.md in the repo root for the full exit plan.

# The loopback port the UI proxies the agent runtime on. It is compiled into the
# route manifest, so the build and the runtime must agree on it.
ARG EVE_PORT=4274

# ---- deps -------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM node:24-alpine AS builder
ARG EVE_PORT
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Force standalone output regardless of any VERCEL var leaking into the build,
# and keep telemetry off in CI images.
ENV MSTRMND_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV EVE_NEXT_PRODUCTION_PORT=${EVE_PORT}

# Build-time-only agent wiring. MSTRMND_WORKFLOW_WORLD is read when the agent is
# compiled, so pass it here (--build-arg) to bind durability to a world package;
# unset means eve's file-backed local world under .eve/.
ARG MSTRMND_WORKFLOW_WORLD
ENV MSTRMND_WORKFLOW_WORLD=${MSTRMND_WORKFLOW_WORLD}

RUN pnpm eve:build
RUN pnpm build

# ---- runner -----------------------------------------------------------------
FROM node:24-alpine AS runner
ARG EVE_PORT
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV EVE_PORT=${EVE_PORT}

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# The agent runtime: a self-contained Nitro bundle, no node_modules needed.
COPY --from=builder --chown=nextjs:nodejs /app/.output ./.output
# The UI: Next's standalone server plus the assets it does not trace.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p .eve && chown nextjs:nodejs .eve

# Durable session and run state lives here under eve's local Workflow world.
# Mount it on persistent storage so runs survive container replacement.
VOLUME ["/app/.eve"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/eve/v1/health || exit 1

CMD ["./docker-entrypoint.sh"]
