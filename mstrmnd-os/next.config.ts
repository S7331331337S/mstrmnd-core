import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { withWorkflow } from "workflow/next";

/**
 * Off Vercel, build a standalone Node server (`.next/standalone/server.js`)
 * so the host app containerizes without a platform build step. On Vercel the
 * platform owns the output, so the option is left off there. Force it either
 * way with MSTRMND_STANDALONE=1 / 0.
 */
function standalone(): boolean {
  if (process.env.MSTRMND_STANDALONE === "1") return true;
  if (process.env.MSTRMND_STANDALONE === "0") return false;
  return !process.env.VERCEL;
}

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.wgsl": {
        loaders: ["@vgpu/wgsl/loader-webpack"],
        as: "*.js",
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.wgsl$/,
      use: "@vgpu/wgsl/loader-webpack",
    });
    return config;
  },
  ...(standalone()
    ? {
        output: "standalone" as const,
        // This app is its own pnpm workspace nested inside mstrmnd-core. Without
        // an explicit root, Next traces up to the outer lockfile and emits the
        // server at `.next/standalone/mstrmnd-os/server.js`. Pin the root so the
        // output stays flat and the container's `node server.js` resolves.
        outputFileTracingRoot: process.cwd(),
        // pnpm's symlinked store hides a few runtime deps from Next's tracer;
        // they are reached through the store path rather than a direct import,
        // so name them explicitly or `node server.js` fails on MODULE_NOT_FOUND.
        outputFileTracingIncludes: {
          "/**/*": [
            "./node_modules/.pnpm/@swc+helpers*/node_modules/@swc/helpers/**/*",
          ],
        },
      }
    : {}),
};

// Compose both wrappers: the eve agent runtime (mounted same-origin at
// /eve/v1/*) and the Workflow SDK (durable, checkpointed orchestration).
export default withEve(withWorkflow(nextConfig));
