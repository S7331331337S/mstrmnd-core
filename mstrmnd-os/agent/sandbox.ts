import { DefaultSandbox, defineSandbox } from "eve/sandbox";
import { DockerSandbox } from "eve/sandbox/docker";
import { JustBashSandbox } from "eve/sandbox/just-bash";
import { VercelSandbox } from "eve/sandbox/vercel";

/**
 * The alliance's single sandbox — the isolated bash environment behind
 * `ctx.getSandbox()` and the approval-gated `execute_code` tool.
 *
 * The provider is an **adapter chosen at the edge**, never a hard dependency of
 * agent or tool code. Vercel Sandbox is one option among several; Docker runs
 * the identical `/workspace` namespace on any host we operate. Nothing under
 * `agent/tools/` may import a vendor sandbox SDK directly.
 *
 *   MSTRMND_SANDBOX          auto (default) | vercel | docker | justbash
 *   MSTRMND_SANDBOX_NETWORK  deny-all (default) | allow-all
 *   MSTRMND_SANDBOX_IMAGE    base image for the docker backend
 *
 * eve 1.0 prepares the sandbox environment during `eve build` and records the
 * provider, so these variables belong in the **build** environment.
 *
 * `auto` uses eve's `DefaultSandbox`: Vercel Sandbox when built on Vercel,
 * Docker when a daemon is reachable at build time, and just-bash only under
 * `eve dev` / `eve eval` (production builds never fall back to just-bash).
 *
 * eve 1.0 removed the microsandbox provider; `MSTRMND_SANDBOX=microsandbox`
 * now fails the build instead of silently picking something else.
 */

/** Coarse egress policy every native backend understands. Default-closed. */
type NetworkPolicy = "allow-all" | "deny-all";

function networkPolicy(): NetworkPolicy {
  return process.env.MSTRMND_SANDBOX_NETWORK === "allow-all"
    ? "allow-all"
    : "deny-all";
}

/** Optional base-image override for the Docker backend. */
function image(): string | undefined {
  return process.env.MSTRMND_SANDBOX_IMAGE || undefined;
}

function selectedBackend(): "auto" | "vercel" | "docker" | "justbash" {
  const raw = process.env.MSTRMND_SANDBOX?.toLowerCase() || "auto";
  switch (raw) {
    case "auto":
    case "vercel":
    case "docker":
    case "justbash":
      return raw;
    case "microsandbox":
      throw new Error(
        "MSTRMND_SANDBOX=microsandbox is no longer supported: eve 1.0 removed the microsandbox provider. Use docker, vercel, or auto.",
      );
    default:
      throw new Error(
        `Unknown MSTRMND_SANDBOX="${raw}". Expected auto, vercel, docker, or justbash.`,
      );
  }
}

const backend = selectedBackend();
const policy = networkPolicy();

/** Human-readable label for the configured backend (status surfaces, errors). */
export function activeSandboxLabel(): string {
  return backend;
}

function build() {
  switch (backend) {
    case "vercel": {
      const environment = VercelSandbox.environment();
      return {
        environment,
        selector: defineSandbox(() => environment.open({ networkPolicy: policy })),
      };
    }
    case "docker": {
      const environment = DockerSandbox.environment({ image: image() });
      return {
        environment,
        selector: defineSandbox(() => environment.open({ networkPolicy: policy })),
      };
    }
    case "justbash": {
      // No real binaries and no network isolation — local development only.
      // just-bash accepts no network policy, so none is passed.
      const environment = JustBashSandbox.environment();
      return { environment, selector: defineSandbox(() => environment.open()) };
    }
    default: {
      const baseImage = image();
      const environment = DefaultSandbox.environment(
        baseImage ? { docker: { image: baseImage } } : {},
      );
      // Fail closed: under `eve dev` the default provider is just-bash, which
      // rejects "deny-all". Set MSTRMND_SANDBOX=justbash (or
      // MSTRMND_SANDBOX_NETWORK=allow-all) to opt in to it explicitly.
      return {
        environment,
        selector: defineSandbox(() => environment.open({ networkPolicy: policy })),
      };
    }
  }
}

const configured = build();

// Required by eve 1.0: `eve build` prepares this export before any session exists.
export const environment = configured.environment;

export default configured.selector;
