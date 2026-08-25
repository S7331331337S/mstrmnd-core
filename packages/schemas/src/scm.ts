/**
 * SCM-neutral repository context. GitHub is the current source of truth.
 * Origin, GitLab, Bitbucket, and future agent-native forges stay interchangeable
 * behind this contract — never couple company memory to one forge.
 */
export type ScmKind = "github" | "origin" | "gitlab" | "bitbucket" | "generic";

export interface ScmRepository {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  kind: ScmKind;
}

export interface ScmPullRequest {
  id: string;
  repositoryId: string;
  title: string;
  status: "open" | "merged" | "closed" | "draft";
  url: string;
}

export interface ScmConnectorInfo {
  kind: ScmKind;
  /** True only for the operator-chosen source of truth (GitHub, for now). */
  sourceOfTruth: boolean;
  status: "active" | "beta-not-migrated" | "available";
  label: string;
}

/**
 * Connector interface — implementations live at the edge (packages/connectors).
 * Domain code depends on this type, not on Octokit, Origin, or GitLab SDKs.
 */
export interface ScmConnector {
  readonly info: ScmConnectorInfo;
  listRepositories(): Promise<ScmRepository[]>;
  getPullRequest(
    repositoryId: string,
    pullId: string
  ): Promise<ScmPullRequest | null>;
}
