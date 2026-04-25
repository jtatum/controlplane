import { z } from "zod";
import type { AgentStatus, AgentEnvironment } from "./enums.js";

export const AgentConfigSchema = z.object({
  model: z
    .object({
      id: z.string().default("anthropic.claude-sonnet-4-20250514-v1:0"),
      temperature: z.number().min(0).max(1).default(0.7),
      maxTokens: z.number().int().positive().default(4096),
    })
    .default({}),
  gateway: z
    .object({
      rateLimit: z.number().int().positive().default(60),
    })
    .default({}),
  features: z.record(z.boolean()).default({}),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  agentName: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  environment: z.enum(["dev", "prod"]),
  config: AgentConfigSchema.optional(),
});
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export interface AgentSummary {
  id: string;
  name: string;
  agentName: string;
  environment: AgentEnvironment;
  status: AgentStatus;
  version: string | null;
  bedrockRegion: string;
  createdAt: string;
}

export interface AgentDetail extends AgentSummary {
  ownerId: string;
  ec2InstanceId: string | null;
  privateIp: string | null;
  availabilityZone: string | null;
  instanceType: string;
  config: AgentConfig;
  provisionedAt: string | null;
  updatedAt: string;
}
