export { readVault, type VaultNote } from "./obsidian/vault-reader";
export { scanDirectory } from "./filesystem/scanner";
export { indexPhotos, type PhotoArtifact } from "./photos/indexer";
export {
  selectScmConnector,
  GitHubScmConnector,
  OriginScmConnector,
  GitLabScmConnector,
  BitbucketScmConnector,
} from "./scm/index";
// A2A is NOT re-exported from the barrel. Import `@mstrmnd/connectors/a2a`
// from an edge host only — intelligence-core must not depend on it.
