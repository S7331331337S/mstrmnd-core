import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

/**
 * execute_code — run untrusted code in an isolated Vercel Sandbox microVM.
 *
 * Approval-gated: a person signs off before anything runs. Actual execution
 * requires Vercel Sandbox credentials in the environment (OIDC via a linked
 * Vercel project, or `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` + `VERCEL_TOKEN`).
 * Without them the tool returns a clear, actionable error instead of failing
 * opaquely. Deeper sandbox wiring is the dedicated execution slice.
 */
export default defineTool({
  description:
    "Run a shell command in an isolated, ephemeral Vercel Sandbox microVM. Use for untrusted or side-effecting code. Requires human approval.",
  approval: always(),
  inputSchema: z.object({
    command: z.string().min(1).describe("Shell command to run"),
    args: z.array(z.string()).optional().describe("Command arguments"),
  }),
  async execute({ command, args }) {
    const hasCreds =
      !!process.env.VERCEL_OIDC_TOKEN ||
      (!!process.env.VERCEL_TOKEN &&
        !!process.env.VERCEL_PROJECT_ID &&
        !!process.env.VERCEL_TEAM_ID);
    if (!hasCreds) {
      return {
        ok: false as const,
        error:
          "Vercel Sandbox is not configured. Link a Vercel project (OIDC) or set VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_TEAM_ID.",
      };
    }

    const { Sandbox } = await import("@vercel/sandbox");
    const sandbox = await Sandbox.create();
    try {
      const result = await sandbox.runCommand({
        cmd: command,
        args: args ?? [],
      });
      const stdout = await result.stdout();
      const stderr = await result.stderr();
      return { ok: true as const, exitCode: result.exitCode, stdout, stderr };
    } finally {
      await sandbox.stop();
    }
  },
});
