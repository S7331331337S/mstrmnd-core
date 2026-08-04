/**
 * Explicit runtime scope for every consequential object.
 * Cross-scope access should be denied by default.
 */
export interface RuntimeScope {
  /** Organization / company tenant */
  organizationId: string;
  /** Workspace within the organization */
  workspaceId: string;
  /** Human operator or user */
  userId: string;
  /** Agent identity when an agent is acting */
  agentId?: string;
  /** Workflow definition id when applicable */
  workflowId?: string;
  /** Concrete run / execution id when applicable */
  runId?: string;
  /** Client id when operating on behalf of a client */
  clientId?: string;
  /** Project id when applicable */
  projectId?: string;
  /** Operator role label (e.g. owner, editor, viewer) */
  role?: string;
  /** Brand id when brand-scoped context applies */
  brandId?: string;
}
