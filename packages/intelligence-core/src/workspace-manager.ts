import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Governs which paths and file extensions agents may write to without
 * explicit human approval.
 *
 * Safe-zone writes (matching allowedPrefixes and allowedExtensions) proceed
 * immediately.  Any path outside the safe zone is blocked and requires the
 * caller to pass `{ force: true }` — representing an explicit human approval
 * step — before the write is carried out.
 */
export interface WorkspacePolicyConfig {
  /** Absolute path prefixes that are unconditionally allowed. */
  allowedPrefixes: string[];
  /** File-extension allow-list (lower-cased, with leading dot, e.g. ".md"). */
  allowedExtensions: string[];
  /** Root used for relative path resolution and audit-log placement. */
  workspaceRoot: string;
}

export interface WriteOptions {
  /**
   * Pass `true` to bypass the policy gate. Represents explicit human
   * approval for writes outside the safe zone.
   */
  force?: boolean;
}

export interface WriteResult {
  path: string;
  written: boolean;
  /** Populated when the write was blocked by policy. */
  policyViolation?: string;
}

const DEFAULT_ALLOWED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml"];

/**
 * Workspace manager that enforces write policy.
 *
 * All agent-initiated file writes should go through this class so that the
 * Operator Zero governance contract (draft → human-approval → persist) is
 * upheld.
 */
export class WorkspaceManager {
  private policy: WorkspacePolicyConfig;

  constructor(config: WorkspacePolicyConfig) {
    this.policy = {
      ...config,
      allowedExtensions: config.allowedExtensions.map((e) =>
        e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
      ),
    };
  }

  /**
   * Attempt to write `content` to `filePath`.
   *
   * - If the path satisfies the policy, the file is written immediately.
   * - If the path violates the policy and `opts.force` is falsy, the write is
   *   blocked and the returned result describes the violation.
   * - If `opts.force` is `true`, the violation is logged but the write
   *   proceeds (representing explicit operator approval).
   */
  async write(
    filePath: string,
    content: string,
    opts: WriteOptions = {}
  ): Promise<WriteResult> {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.policy.workspaceRoot, filePath);

    const violation = this.checkPolicy(abs);

    if (violation && !opts.force) {
      await this.audit("BLOCKED", abs, violation);
      return { path: abs, written: false, policyViolation: violation };
    }

    if (violation && opts.force) {
      await this.audit("FORCE_WRITE", abs, violation);
    }

    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
    await this.audit("WRITE", abs);
    return { path: abs, written: true };
  }

  /**
   * Read a file from the workspace.  No policy check — reads are always
   * permitted (agents need to read before they can plan writes).
   */
  async read(filePath: string): Promise<string | null> {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.policy.workspaceRoot, filePath);
    if (!existsSync(abs)) return null;
    return readFile(abs, "utf8");
  }

  /** Returns whether the given absolute path satisfies the write policy. */
  isAllowed(filePath: string): boolean {
    return this.checkPolicy(filePath) === null;
  }

  private checkPolicy(abs: string): string | null {
    const ext = path.extname(abs).toLowerCase();
    if (!this.policy.allowedExtensions.includes(ext)) {
      return `Extension "${ext}" is not in the allowed-extension list (${this.policy.allowedExtensions.join(", ")}).`;
    }

    const normalised = abs.endsWith(path.sep) ? abs : abs + path.sep;
    const allowed = this.policy.allowedPrefixes.some((prefix) => {
      const p = prefix.endsWith(path.sep) ? prefix : prefix + path.sep;
      return normalised.startsWith(p) || abs.startsWith(prefix);
    });

    if (!allowed) {
      return `Path "${abs}" is outside all allowed prefixes (${this.policy.allowedPrefixes.join(", ")}).`;
    }

    return null;
  }

  private async audit(
    action: "WRITE" | "BLOCKED" | "FORCE_WRITE",
    filePath: string,
    reason?: string
  ): Promise<void> {
    const logPath = path.join(
      this.policy.workspaceRoot,
      ".mstrmnd",
      "workspace-audit.log"
    );
    try {
      await mkdir(path.dirname(logPath), { recursive: true });
      const line = `${new Date().toISOString()} [${action}] ${filePath}${reason ? ` — ${reason}` : ""}\n`;
      const existing = existsSync(logPath)
        ? await readFile(logPath, "utf8")
        : "";
      await writeFile(logPath, existing + line, "utf8");
    } catch {
      // Audit log failures must never block agent writes.
    }
  }

  static defaultConfig(workspaceRoot: string): WorkspacePolicyConfig {
    return {
      workspaceRoot,
      allowedPrefixes: [workspaceRoot],
      allowedExtensions: DEFAULT_ALLOWED_EXTENSIONS,
    };
  }
}
