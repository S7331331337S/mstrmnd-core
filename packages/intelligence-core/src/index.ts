export { MemoryEngine } from "./memory-engine";
export type { LoadSourceOptions } from "./memory-engine";
export { VectorEngine } from "./vector-engine";
export { GraphEngine } from "./graph-engine";
export { resolveVaultPath } from "./vault-path";
export { loadIdentity, EMPTY_IDENTITY } from "./identity-loader";
export {
  OPERATOR_ZERO_SCOPE,
  resolveScope,
  localProvenance,
  nowIso,
} from "./operator-scope";
export {
  readObsidianSourceRecords,
  vaultNotesToSourceRecords,
} from "./obsidian-adapter";
