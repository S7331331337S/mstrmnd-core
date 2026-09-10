import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  RuntimeScope,
  WorkspaceMount,
  WorkspaceNode,
} from "@mstrmnd/schemas";
import { localProvenance, nowIso, resolveScope } from "./operator-scope";

const DEFAULT_READ_CAP = 256_000;
const SKIP_DIRS = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
  ".turbo",
  ".venv",
]);

/** Mount-relative directory where unpublished writes are staged. */
export const DRAFT_DIR = ".mstrmnd/drafts";

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export interface WorkspaceDraft {
  id: string;
  mountId: string;
  /** Mount-relative publish target. */
  targetPath: string;
  /** Mount-relative staged file. */
  draftPath: string;
  createdAt: string;
  bytes: number;
}

interface DraftRecord extends WorkspaceDraft {
  content: string;
}

/**
 * True when `abs` is the root or a descendant, compared component-wise.
 * A textual `startsWith` on the raw prefix would also accept siblings
 * (`/data/vault-backup` vs `/data/vault`).
 */
export function isInsideRoot(abs: string, root: string): boolean {
  const absParts = resolve(abs).split(sep);
  const rootParts = resolve(root).split(sep);
  if (absParts.length < rootParts.length) return false;
  return rootParts.every((part, i) => absParts[i] === part);
}

export class WorkspaceService {
  private mounts = new Map<string, WorkspaceMount>();
  private drafts = new Map<string, DraftRecord>();

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
    const root = resolve(mount.rootPath);
    const abs = resolve(root, cleaned);
    if (!isInsideRoot(abs, root)) {
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

  /**
   * Write `content` to a mount-relative path. Callers must have already
   * passed the human-approval gate — this method only enforces the mount
   * boundary.
   */
  async write(
    mountId: string,
    relPath: string,
    content: string
  ): Promise<{ path: string; bytes: number }> {
    const { mount, abs } = this.resolveSafe(mountId, relPath);
    await mkdir(dirname(abs), { recursive: true });
    const buf = Buffer.from(content, "utf8");
    await writeFile(abs, buf);
    return {
      path: relative(mount.rootPath, abs).split(sep).join("/"),
      bytes: buf.length,
    };
  }

  /**
   * Stage a proposed write under `.mstrmnd/drafts/`. Does not touch the
   * publish target. Out-of-mount targets throw before anything is staged.
   */
  async stageDraft(
    mountId: string,
    targetPath: string,
    content: string
  ): Promise<WorkspaceDraft> {
    this.resolveSafe(mountId, targetPath);
    const id = randomUUID();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = targetPath.replace(/\\/g, "/").split("/").filter(Boolean).pop()
      ?? `draft-${id.slice(0, 8)}`;
    const draftPath = `${DRAFT_DIR}/${stamp}-${id.slice(0, 8)}-${base}`;
    const written = await this.write(mountId, draftPath, content);
    const record: DraftRecord = {
      id,
      mountId,
      targetPath,
      draftPath: written.path,
      createdAt: nowIso(),
      bytes: written.bytes,
      content,
    };
    this.drafts.set(id, record);
    await this.write(
      mountId,
      `${written.path}.meta.json`,
      JSON.stringify(
        {
          id: record.id,
          mountId: record.mountId,
          targetPath: record.targetPath,
          draftPath: record.draftPath,
          createdAt: record.createdAt,
          bytes: record.bytes,
        },
        null,
        2
      )
    );
    return this.toPublicDraft(record);
  }

  getDraft(draftId: string): WorkspaceDraft | undefined {
    const record = this.drafts.get(draftId);
    return record ? this.toPublicDraft(record) : undefined;
  }

  private toPublicDraft(record: DraftRecord): WorkspaceDraft {
    return {
      id: record.id,
      mountId: record.mountId,
      targetPath: record.targetPath,
      draftPath: record.draftPath,
      createdAt: record.createdAt,
      bytes: record.bytes,
    };
  }

  private async loadDraftRecord(draftId: string): Promise<DraftRecord> {
    const cached = this.drafts.get(draftId);
    if (cached) return cached;
    for (const mount of this.mounts.values()) {
      const draftRoot = join(mount.rootPath, ".mstrmnd", "drafts");
      if (!existsSync(draftRoot)) continue;
      const entries = await readdir(draftRoot);
      for (const name of entries) {
        if (!name.endsWith(".meta.json")) continue;
        const abs = join(draftRoot, name);
        const raw = await readFile(abs, "utf8");
        const meta = JSON.parse(raw) as WorkspaceDraft;
        if (meta.id !== draftId) continue;
        const body = await this.read(mount.id, meta.draftPath);
        const record: DraftRecord = { ...meta, mountId: mount.id, content: body.content };
        this.drafts.set(draftId, record);
        return record;
      }
    }
    throw new WorkspacePathError(`unknown draft: ${draftId}`);
  }

  /**
   * Publish a previously staged draft to its target path. The target is
   * re-checked against the mount boundary.
   */
  async publishDraft(draftId: string): Promise<{ path: string; bytes: number }> {
    const record = await this.loadDraftRecord(draftId);
    return this.write(record.mountId, record.targetPath, record.content);
  }
}
