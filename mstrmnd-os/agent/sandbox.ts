import { defaultBackend, defineSandbox, type SandboxBackend } from "eve/sandbox";
import { docker } from "eve/sandbox/docker";
import { justbash } from "eve/sandbox/just-bash";
import { microsandbox } from "eve/sandbox/microsandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * The alliance's single sandbox — the isolated bash environment behind
 * `ctx.getSandbox()` and the approval-gated `execute_code` tool.
 *
 * The backend is an **adapter chosen at the edge**, never a hard dependency of
 * agent or tool code. Vercel Sandbox is one option among several; Docker or
 * microsandbox run the identical `/workspace` namespace on any host we operate.
 * Nothing under `agent/tools/` may import a vendor sandbox SDK directly.
 *
 *   MSTRMND_SANDBOX          auto (default) | vercel | docker | microsandbox | justbash
 *   MSTRMND_SANDBOX_NETWORK  deny-all (default) | allow-all
 *   MSTRMND_SANDBOX_IMAGE    base image for the docker / microsandbox backends
 *
 * `auto` defers to eve's availability probe: Vercel Sandbox when deployed on
 * Vercel, else Docker, else microsandbox, else the dependency-free just-bash
 * interpreter. Pin a backend explicitly when the host must be deterministic.
 */

/** Coarse egress policy every backend understands. Default-closed. */
type NetworkPolicy = "allow-all" | "deny-all";

function networkPolicy(): NetworkPolicy {
  return process.env.MSTRMND_SANDBOX_NETWORK === "allow-all"
    ? "allow-all"
    : "deny-all";
}

/** Optional base-image override for the container/VM backends. */
function image(): string | undefined {
  return process.env.MSTRMND_SANDBOX_IMAGE || undefined;
}

function selectBackend(): SandboxBackend {
  const policy = networkPolicy();
  const baseImage = image();

  switch (process.env.MSTRMND_SANDBOX?.toLowerCase()) {
    case "vercel":
      return vercel({ networkPolicy: policy });
    case "docker":
      return docker({ networkPolicy: policy, image: baseImage });
    case "microsandbox":
      return microsandbox({ networkPolicy: policy, image: baseImage });
    case "justbash":
      // No real binaries and no network isolation — local development only.
      return justbash();
    default:
      return defaultBackend({
        vercel: { networkPolicy: policy },
        docker: { networkPolicy: policy, image: baseImage },
        microsandbox: { networkPolicy: policy, image: baseImage },
      });
  }
}

/** Human-readable label for the configured backend (status surfaces, errors). */
export function activeSandboxLabel(): string {
  return process.env.MSTRMND_SANDBOX?.toLowerCase() || "auto";
}

export default defineSandbox({
  backend: selectBackend(),
});
