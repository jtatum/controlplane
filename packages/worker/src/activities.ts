import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
  type Tag,
} from "@aws-sdk/client-ec2";
import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";
import { randomBytes, createHash } from "node:crypto";
import pg from "pg";
import {
  assertTransition,
  InvalidStatusTransitionError,
} from "@controlplane/shared";

export interface ProvisionAgentInput {
  agentId: string;
  agentName: string;
  instanceType: string;
  environment: string;
  bedrockRegion: string;
  amiId: string;
  subnetId: string;
  securityGroupId: string;
  instanceProfileArn: string;
}

export interface LaunchInstanceResult {
  instanceId: string;
  availabilityZone: string;
}

export interface WaitForBootstrapResult {
  privateIp: string;
}

export interface DeliverTokenResult {
  tokenHash: string;
}

const ec2 = new EC2Client({});
const ssm = new SSMClient({});
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function launchInstance(
  input: ProvisionAgentInput,
): Promise<LaunchInstanceResult> {
  const tags: Tag[] = [
    { Key: "Name", Value: `openclaw-${input.agentName}` },
    { Key: "openclaw:agent-id", Value: input.agentId },
    { Key: "openclaw:environment", Value: input.environment },
    { Key: "ManagedBy", Value: "controlplane" },
  ];

  const userDataScript = [
    "#!/bin/bash",
    "set -euo pipefail",
    `echo "${input.agentId}" > /opt/openclaw/agent-id`,
    `echo "${input.environment}" > /opt/openclaw/environment`,
    `aws ssm get-parameter --name "/openclaw/agents/${input.agentId}/token" --with-decryption --query Parameter.Value --output text > /opt/openclaw/agent-token`,
    "systemctl start openclaw-agent",
  ].join("\n");

  const result = await ec2.send(
    new RunInstancesCommand({
      ImageId: input.amiId,
      InstanceType: input.instanceType as never,
      MinCount: 1,
      MaxCount: 1,
      SubnetId: input.subnetId,
      SecurityGroupIds: [input.securityGroupId],
      IamInstanceProfile: { Arn: input.instanceProfileArn },
      UserData: Buffer.from(userDataScript).toString("base64"),
      TagSpecifications: [
        { ResourceType: "instance", Tags: tags },
        { ResourceType: "volume", Tags: tags },
      ],
    }),
  );

  const instance = result.Instances?.[0];
  if (!instance?.InstanceId) {
    throw new Error("EC2 RunInstances returned no instance");
  }

  return {
    instanceId: instance.InstanceId,
    availabilityZone: instance.Placement?.AvailabilityZone ?? "unknown",
  };
}

export async function waitForBootstrap(input: {
  instanceId: string;
}): Promise<WaitForBootstrapResult> {
  const maxAttempts = 60;
  const pollIntervalMs = 5_000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await ec2.send(
      new DescribeInstancesCommand({
        InstanceIds: [input.instanceId],
      }),
    );

    const instance = result.Reservations?.[0]?.Instances?.[0];
    if (!instance) {
      throw new Error(`Instance ${input.instanceId} not found`);
    }

    if (instance.State?.Name === "running" && instance.PrivateIpAddress) {
      return { privateIp: instance.PrivateIpAddress };
    }

    if (
      instance.State?.Name === "terminated" ||
      instance.State?.Name === "shutting-down"
    ) {
      throw new Error(
        `Instance ${input.instanceId} entered state: ${instance.State.Name}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Instance ${input.instanceId} did not reach running state within ${(maxAttempts * pollIntervalMs) / 1000}s`,
  );
}

export async function deliverToken(input: {
  agentId: string;
}): Promise<DeliverTokenResult> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await ssm.send(
    new PutParameterCommand({
      Name: `/openclaw/agents/${input.agentId}/token`,
      Value: token,
      Type: "SecureString",
      Overwrite: true,
      Description: `Agent bearer token for ${input.agentId}`,
    }),
  );

  return { tokenHash };
}

export async function healthCheck(input: {
  privateIp: string;
}): Promise<void> {
  const maxAttempts = 24;
  const pollIntervalMs = 5_000;
  const url = `http://${input.privateIp}:8080/health`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Agent not ready yet — retry
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Agent health check at ${url} failed after ${(maxAttempts * pollIntervalMs) / 1000}s`,
  );
}

export async function updateAgentStatus(input: {
  agentId: string;
  status: string;
  ec2InstanceId?: string;
  privateIp?: string;
  availabilityZone?: string;
  agentTokenHash?: string;
}): Promise<void> {
  const currentResult = await pool.query(
    `SELECT status FROM agents WHERE id = $1`,
    [input.agentId],
  );
  const currentStatus = currentResult.rows[0]?.status;
  if (!currentStatus) {
    throw new Error(`Agent ${input.agentId} not found`);
  }

  if (currentStatus !== input.status) {
    assertTransition(currentStatus, input.status as never);
  }

  const setClauses: string[] = [`status = $2`, `updated_at = now()`];
  const values: unknown[] = [input.agentId, input.status];
  let paramIdx = 3;

  if (input.ec2InstanceId !== undefined) {
    setClauses.push(`ec2_instance_id = $${paramIdx}`);
    values.push(input.ec2InstanceId);
    paramIdx++;
  }
  if (input.privateIp !== undefined) {
    setClauses.push(`private_ip = $${paramIdx}`);
    values.push(input.privateIp);
    paramIdx++;
  }
  if (input.availabilityZone !== undefined) {
    setClauses.push(`availability_zone = $${paramIdx}`);
    values.push(input.availabilityZone);
    paramIdx++;
  }
  if (input.agentTokenHash !== undefined) {
    setClauses.push(`agent_token_hash = $${paramIdx}`);
    values.push(input.agentTokenHash);
    paramIdx++;
  }
  if (input.status === "running") {
    setClauses.push(`provisioned_at = now()`);
  }
  if (input.status === "terminated") {
    setClauses.push(`terminated_at = now()`);
  }

  await pool.query(
    `UPDATE agents SET ${setClauses.join(", ")} WHERE id = $1`,
    values,
  );
}

export async function updateProvisioningJob(input: {
  workflowId: string;
  status: string;
  result?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<void> {
  const setClauses: string[] = [`status = $2`, `updated_at = now()`];
  const values: unknown[] = [input.workflowId, input.status];
  let paramIdx = 3;

  if (input.status === "running") {
    setClauses.push(`started_at = now()`);
  }
  if (input.status === "succeeded" || input.status === "failed") {
    setClauses.push(`completed_at = now()`);
  }
  if (input.result !== undefined) {
    setClauses.push(`result = $${paramIdx}`);
    values.push(JSON.stringify(input.result));
    paramIdx++;
  }
  if (input.errorMessage !== undefined) {
    setClauses.push(`error_message = $${paramIdx}`);
    values.push(input.errorMessage);
    paramIdx++;
  }

  await pool.query(
    `UPDATE provisioning_jobs SET ${setClauses.join(", ")} WHERE temporal_workflow_id = $1`,
    values,
  );
}

export async function terminateInstance(input: {
  instanceId: string;
}): Promise<void> {
  await ec2.send(
    new TerminateInstancesCommand({
      InstanceIds: [input.instanceId],
    }),
  );
}

export async function cleanupAgentData(input: {
  agentId: string;
}): Promise<{ deletedChannels: number; deletedSkills: number; archivedMessages: number }> {
  const channelResult = await pool.query(
    `DELETE FROM channels WHERE agent_id = $1`,
    [input.agentId],
  );

  const skillResult = await pool.query(
    `DELETE FROM agent_skills WHERE agent_id = $1`,
    [input.agentId],
  );

  const messageResult = await pool.query(
    `UPDATE email_messages SET visible_to_agent = false, updated_at = now() WHERE agent_id = $1 AND visible_to_agent = true`,
    [input.agentId],
  );

  return {
    deletedChannels: channelResult.rowCount ?? 0,
    deletedSkills: skillResult.rowCount ?? 0,
    archivedMessages: messageResult.rowCount ?? 0,
  };
}
