export type PlanStepStatus = "pending" | "running" | "done" | "error";

export interface PlanStep {
  id: string;
  description: string;
  tool?: string;
  args?: Record<string, unknown>;
  status: PlanStepStatus;
  result?: string;
  error?: string;
}

export interface AgentPlan {
  goal: string;
  steps: PlanStep[];
  createdAt: Date;
}
