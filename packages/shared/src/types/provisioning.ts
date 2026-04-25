import type { ProvisioningJobStatus, ProvisioningJobType } from "./enums.js";

export interface ProvisioningJob {
  id: string;
  agentId: string | null;
  type: ProvisioningJobType;
  status: ProvisioningJobStatus;
  initiatedBy: string;
  temporalWorkflowId: string | null;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
