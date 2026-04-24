export const AgentStatus = {
  Requested: "requested",
  Provisioning: "provisioning",
  Running: "running",
  Updating: "updating",
  Stopping: "stopping",
  Stopped: "stopped",
  Terminated: "terminated",
  Error: "error",
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

export const AgentEnvironment = {
  Dev: "dev",
  Prod: "prod",
} as const;
export type AgentEnvironment =
  (typeof AgentEnvironment)[keyof typeof AgentEnvironment];

export const UserRole = {
  Admin: "admin",
  User: "user",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ChannelType = {
  Telegram: "telegram",
  Email: "email",
  Slack: "slack",
  Discord: "discord",
} as const;
export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

export const EmailDirection = {
  Inbound: "inbound",
  Outbound: "outbound",
} as const;
export type EmailDirection =
  (typeof EmailDirection)[keyof typeof EmailDirection];

export const ReviewStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const ProvisioningJobStatus = {
  Pending: "pending",
  Running: "running",
  Succeeded: "succeeded",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type ProvisioningJobStatus =
  (typeof ProvisioningJobStatus)[keyof typeof ProvisioningJobStatus];

export const ProvisioningJobType = {
  Provision: "provision",
  Terminate: "terminate",
  Upgrade: "upgrade",
  DeploySkills: "deploy_skills",
  PatchOs: "patch_os",
  FleetRollout: "fleet_rollout",
} as const;
export type ProvisioningJobType =
  (typeof ProvisioningJobType)[keyof typeof ProvisioningJobType];
