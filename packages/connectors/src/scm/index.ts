import type { ScmConnector, ScmConnectorInfo, ScmKind, ScmPullRequest, ScmRepository } from "@mstrmnd/schemas";

export abstract class BaseScmConnector implements ScmConnector {
  abstract readonly info: ScmConnectorInfo;
  abstract listRepositories(): Promise<ScmRepository[]>;
  abstract getPullRequest(
    repositoryId: string,
    pullId: string
  ): Promise<ScmPullRequest | null>;
}

/** GitHub remains MSTRMND source of truth. Live API calls are optional. */
export class GitHubScmConnector extends BaseScmConnector {
  readonly info: ScmConnectorInfo = {
    kind: "github",
    sourceOfTruth: true,
    status: "active",
    label: "GitHub",
  };

  async listRepositories(): Promise<ScmRepository[]> {
    return [];
  }

  async getPullRequest(): Promise<ScmPullRequest | null> {
    return null;
  }
}

/**
 * Cursor Origin (early beta). Interchangeable at the type level.
 * Do not migrate Core here while it is beta.
 */
export class OriginScmConnector extends BaseScmConnector {
  readonly info: ScmConnectorInfo = {
    kind: "origin",
    sourceOfTruth: false,
    status: "beta-not-migrated",
    label: "Cursor Origin",
  };

  async listRepositories(): Promise<ScmRepository[]> {
    return [];
  }

  async getPullRequest(): Promise<ScmPullRequest | null> {
    return null;
  }
}

export class GitLabScmConnector extends BaseScmConnector {
  readonly info: ScmConnectorInfo = {
    kind: "gitlab",
    sourceOfTruth: false,
    status: "available",
    label: "GitLab",
  };

  async listRepositories(): Promise<ScmRepository[]> {
    return [];
  }

  async getPullRequest(): Promise<ScmPullRequest | null> {
    return null;
  }
}

export class BitbucketScmConnector extends BaseScmConnector {
  readonly info: ScmConnectorInfo = {
    kind: "bitbucket",
    sourceOfTruth: false,
    status: "available",
    label: "Bitbucket",
  };

  async listRepositories(): Promise<ScmRepository[]> {
    return [];
  }

  async getPullRequest(): Promise<ScmPullRequest | null> {
    return null;
  }
}

export function selectScmConnector(kind: string | undefined = process.env.MSTRMND_SCM): ScmConnector {
  const resolved = (kind ?? "github").toLowerCase() as ScmKind;
  switch (resolved) {
    case "origin":
      return new OriginScmConnector();
    case "gitlab":
      return new GitLabScmConnector();
    case "bitbucket":
      return new BitbucketScmConnector();
    case "github":
    default:
      return new GitHubScmConnector();
  }
}
