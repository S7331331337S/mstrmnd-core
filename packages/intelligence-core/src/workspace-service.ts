import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type {
  RuntimeScope,
  WorkspaceMount,
  WorkspaceNode,
} from "@mstrmnd/schemas";
import { localProvenance, resolveScope } from "./operator-scope";

const DEFAULT_READ_CAP = 256_000;
const SKIP_DIRS = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
  ".turbo",
  ".venv",
]);

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export class WorkspaceService {
  private mounts = new Map<string, WorkspaceMount>();

  registerMount(mount: WorkspaceMount): void {
    if (!existsSync(mount.rootPath)) {
      throw new WorkspacePathError(`mount root missing: ${mount.rootPath}`);
    }
    this.mounts.set(mount.id, mount);
  }

  /** Register the Obsidian/vault path as the primary mount. */
  registerVaultMount(
    vaultPath: string,
    scope?: Partial<RuntimeScope>,
    id = "vault"
  ): WorkspaceMount {
    const resolved = resolveScope(scope);
    const mount: WorkspaceMount = {
      id,
      rootPath: resolve(vaultPath),
      adapter: "obsidian",
      label: "Obsidian vault",
      scope: resolved,
      provenance: localProvenance("obsidian", {
        adapter: "workspace-service",
        sourcePath: vaultPath,
      }),
    };
    this.registerMount(mount);
    return mount;
  }

  listMounts(): WorkspaceMount[] {
    return [...this.mounts.values()];
  }

  getMount(id: string): WorkspaceMount | undefined {
    return this.mounts.get(id);
  }

  /** Resolve a mount-relative path to an absolute path; deny escapes. */
  resolveSafe(mountId: string, relPath = ""): { mount: WorkspaceMount; abs: string } {
    const mount = this.mounts.get(mountId);
    if (!mount) throw new WorkspacePathError(`unknown mount: ${mountId}`);
    const cleaned = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (cleaned.split("/").includes("..")) {
      throw new WorkspacePathError("path escape denied");
    }
    const abs = resolve(mount.rootPath, cleaned);
    const root = resolve(mount.rootPath);
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw new WorkspacePathError("path escape denied");
    }
    return { mount, abs };
  }

  async list(
    mountId: string,
    relPath = ""
  ): Promise<WorkspaceNode[]> {
    const { mount, abs } = this.resolveSafe(mountId, relPath);
    if (!existsSync(abs)) {
      throw new WorkspacePathError(`not found: ${relPath}`);
    }
    const st = await stat(abs);
    if (!st.isDirectory()) {
      throw new WorkspacePathError(`not a directory: ${relPath}`);
    }
    const entries = await readdir(abs, { withFileTypes: true });
    const nodes: WorkspaceNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      }
      if (SKIP_DIRS.has(entry.name)) continue;
      const childAbs = join(abs, entry.name);
      const childRel = relative(mount.rootPath, childAbs).split(sep).join("/");
      const cst = await stat(childAbs);
      nodes.push({
        path: childRel,
        kind: entry.isDirectory() ? "directory" : "file",
        name: entry.name,
        size: entry.isFile() ? cst.size : undefined,
        mtimeMs: cst.mtimeMs,
        scope: mount.scope,
        provenance: localProvenance(mount.adapter, {
          adapter: "workspace-service",
          sourcePath: childRel,
        }),
        mountId: mount.id,
      });
    }
    return nodes.sort((a, b) => a.path.localeCompare(b.path));
  }

  async read(
    mountId: string,
    relPath: string,
    maxBytes = DEFAULT_READ_CAP
  ): Promise<{ path: string; content: string; truncated: boolean; bytes: number }> {
    const { mount, abs } = this.resolveSafe(mountId, relPath);
    if (!existsSync(abs)) {
      throw new WorkspacePathError(`not found: ${relPath}`);
    }
    const st = await stat(abs);
    if (!st.isFile()) {
      throw new WorkspacePathError(`not a file: ${relPath}`);
    }
    const buf = await readFile(abs);
    const truncated = buf.length > maxBytes;
    const slice = truncated ? buf.subarray(0, maxBytes) : buf;
    return {
      path: relative(mount.rootPath, abs).split(sep).join("/"),
      content: slice.toString("utf8"),
      truncated,
      bytes: buf.length,
    };
  }

  async stat(mountId: string, relPath = ""): Promise<WorkspaceNode> {
    const { mount, abs } = this.resolveSafe(mountId, relPath);
    if (!existsSync(abs)) {
      throw new WorkspacePathError(`not found: ${relPath || "."}`);
    }
    const st = await stat(abs);
    const rel = relative(mount.rootPath, abs).split(sep).join("/");
    return {
      path: rel,
      kind: st.isDirectory() ? "directory" : "file",
      name: rel.split("/").filter(Boolean).pop() ?? mount.id,
      size: st.isFile() ? st.size : undefined,
      mtimeMs: st.mtimeMs,
      scope: mount.scope,
      provenance: localProvenance(mount.adapter, {
        adapter: "workspace-service",
        sourcePath: rel,
      }),
      mountId: mount.id,
    };
  }
}
