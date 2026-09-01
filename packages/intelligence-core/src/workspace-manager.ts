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
      // Resolve prefixes up front so that `..` segments and trailing
      // separators cannot change how the boundary check below behaves.
      allowedPrefixes: config.allowedPrefixes.map((prefix) =>
        path.resolve(prefix)
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
    const abs = this.resolvePath(filePath);

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
    const abs = this.resolvePath(filePath);
    if (!existsSync(abs)) return null;
    return readFile(abs, "utf8");
  }

  /** Returns whether the given path satisfies the write policy. */
  isAllowed(filePath: string): boolean {
    return this.checkPolicy(this.resolvePath(filePath)) === null;
  }

  /**
   * Resolve `filePath` to an absolute path. Relative paths are always resolved
   * against the workspace root — never the process cwd — so that policy
   * decisions do not depend on where the agent happened to be launched from.
   */
  resolvePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.policy.workspaceRoot, filePath);
  }

  /** `abs` must already be resolved via {@link resolvePath}. */
  private checkPolicy(abs: string): string | null {
    const ext = path.extname(abs).toLowerCase();
    if (!this.policy.allowedExtensions.includes(ext)) {
      return `Extension "${ext}" is not in the allowed-extension list (${this.policy.allowedExtensions.join(", ")}).`;
    }

    // Compare on path-component boundaries. A bare `startsWith` on the raw
    // prefix would also accept siblings that merely share a textual prefix —
    // e.g. an allowed prefix of "/data/vault" would admit
    // "/data/vault-backup/note.md", which is outside the approved workspace.
    const allowed = this.policy.allowedPrefixes.some((prefix) => {
      if (abs === prefix) return true;
      const withSep = prefix.endsWith(path.sep) ? prefix : prefix + path.sep;
      return abs.startsWith(withSep);
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
