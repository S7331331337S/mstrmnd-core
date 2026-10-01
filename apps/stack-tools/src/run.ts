import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type Runner = (
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
) => Promise<CommandResult>;

export function resolveBin(command: string): string {
  if (command.includes("/") || command.includes("\\")) return command;
  const roots = [
    PACKAGE_ROOT,
    process.cwd(),
    process.env.MSTRMND_CORE,
    join(process.cwd(), "apps", "stack-tools"),
    join(process.cwd(), "..", "stack-tools"),
  ].filter((p): p is string => Boolean(p));
  for (const root of roots) {
    const candidate = join(root, "node_modules", ".bin", command);
    if (existsSync(candidate)) return candidate;
  }
  return command;
}

export const defaultRunner: Runner = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(resolveBin(command), args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({ code: 127, stdout: "", stderr: `${command} not found` });
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8").trim(),
        stderr: Buffer.concat(err).toString("utf8").trim(),
      });
    });
  });

export function firstVersion(text: string): string | null {
  const match = text.match(/v?\d+\.\d+\.\d+[\w.-]*/);
  return match?.[0] ?? null;
}
