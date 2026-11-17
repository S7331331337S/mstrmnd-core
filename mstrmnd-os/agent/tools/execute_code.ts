import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

/**
 * execute_code — run untrusted code in the agent's isolated sandbox.
 *
 * Approval-gated: a person signs off before anything runs.
 *
 * The tool is deliberately **backend-agnostic**. It asks the runtime for the
 * session's sandbox handle and never imports a vendor SDK, so the same tool
 * runs against Vercel Sandbox, a Docker container, a microsandbox VM, or a
 * custom isolation service. Which one is in play is decided once, at the edge,
 * in `agent/sandbox.ts` — see `docs/portability.md` in the repo root.
 */

/** Quote one argv entry for POSIX `sh -c`, so args never re-enter the parser. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export default defineTool({
  description:
    "Run a shell command in the agent's isolated, ephemeral sandbox. Use for untrusted or side-effecting code. Requires human approval.",
  approval: always(),
  inputSchema: z.object({
    command: z.string().min(1).describe("Shell command to run"),
    args: z.array(z.string()).optional().describe("Command arguments"),
  }),
  async execute({ command, args }, ctx) {
    const line =
      args && args.length > 0
        ? `${command} ${args.map(shellQuote).join(" ")}`
        : command;

    try {
      const sandbox = await ctx.getSandbox();
      const result = await sandbox.run({ command: line });
      return {
        ok: true as const,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (err) {
      // A missing backend (no Docker daemon, no Vercel credentials) surfaces
      // here. Return it as a readable result instead of failing opaquely.
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
        hint: "Check the sandbox backend: MSTRMND_SANDBOX selects vercel | docker | microsandbox | justbash (default: auto).",
      };
    }
  },
});
