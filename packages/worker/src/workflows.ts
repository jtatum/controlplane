import {
  proxyActivities,
  workflowInfo,
  ApplicationFailure,
} from "@temporalio/workflow";
import type * as activities from "./activities.js";

const act = proxyActivities<typeof activities>({
  startToCloseTimeout: "30s",
  retry: { maximumAttempts: 3 },
});

const longAct = proxyActivities<typeof activities>({
  startToCloseTimeout: "10m",
  retry: { maximumAttempts: 2 },
  heartbeatTimeout: "30s",
});

export interface ProvisionAgentWorkflowInput {
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

export async function provisionAgent(
  input: ProvisionAgentWorkflowInput,
): Promise<void> {
  const { workflowId } = workflowInfo();

  await act.updateProvisioningJob({ workflowId, status: "running" });

  try {
    await act.updateAgentStatus({
      agentId: input.agentId,
      status: "provisioning",
    });

    const { instanceId, availabilityZone } = await act.launchInstance(input);

    await act.updateAgentStatus({
      agentId: input.agentId,
      status: "provisioning",
      ec2InstanceId: instanceId,
      availabilityZone,
    });

    const { privateIp } = await longAct.waitForBootstrap({ instanceId });

    await act.updateAgentStatus({
      agentId: input.agentId,
      status: "provisioning",
      privateIp,
    });

    const { tokenHash } = await act.deliverToken({
      agentId: input.agentId,
    });

    await act.updateAgentStatus({
      agentId: input.agentId,
      status: "provisioning",
      agentTokenHash: tokenHash,
    });

    await longAct.healthCheck({ privateIp });

    await act.updateAgentStatus({
      agentId: input.agentId,
      status: "running",
    });

    await act.updateProvisioningJob({
      workflowId,
      status: "succeeded",
      result: { instanceId, privateIp, availabilityZone },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown provisioning error";

    await act
      .updateAgentStatus({ agentId: input.agentId, status: "error" })
      .catch(() => {});

    await act
      .updateProvisioningJob({
        workflowId,
        status: "failed",
        errorMessage: message,
      })
      .catch(() => {});

    throw ApplicationFailure.nonRetryable(message);
  }
}
