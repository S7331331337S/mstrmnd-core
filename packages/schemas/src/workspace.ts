import type { RuntimeScope } from "./scope";
import type { Provenance } from "./provenance";

export type WorkspaceAdapterKind = "obsidian" | "filesystem";

/** Managed mounts the runtime owns. Vault is never one of these. */
export const DRAFTS_MOUNT_ID = "drafts";
export const STAGING_MOUNT_ID = "staging";

export interface WorkspaceMount {
  id: string;
  /** Absolute root path on disk */
  rootPath: string;
  adapter: WorkspaceAdapterKind;
  scope: RuntimeScope;
  provenance: Provenance;
  label?: string;
}

export type WorkspaceNodeKind = "file" | "directory";

export interface WorkspaceNode {
  /** Mount-relative POSIX path ("" = mount root) */
  path: string;
  kind: WorkspaceNodeKind;
  name: string;
  size?: number;
  mtimeMs?: number;
  scope: RuntimeScope;
  provenance: Provenance;
  mountId: string;
}
