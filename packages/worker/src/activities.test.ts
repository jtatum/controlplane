import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-ec2", () => {
  const send = vi.fn();
  return {
    EC2Client: vi.fn(() => ({ send })),
    RunInstancesCommand: vi.fn((input: unknown) => ({
      _type: "RunInstances",
      input,
    })),
    DescribeInstancesCommand: vi.fn((input: unknown) => ({
      _type: "DescribeInstances",
      input,
    })),
  };
});

vi.mock("@aws-sdk/client-ssm", () => {
  const send = vi.fn();
  return {
    SSMClient: vi.fn(() => ({ send })),
    PutParameterCommand: vi.fn((input: unknown) => ({
      _type: "PutParameter",
      input,
    })),
  };
});

const baseInput = {
  agentId: "00000000-0000-0000-0000-000000000001",
  agentName: "test-agent",
  instanceType: "t4g.medium",
  environment: "dev",
  bedrockRegion: "us-east-1",
  amiId: "ami-12345678",
  subnetId: "subnet-abc",
  securityGroupId: "sg-123",
  instanceProfileArn: "arn:aws:iam::123:instance-profile/test",
};

describe("launchInstance", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns instanceId and availabilityZone on success", async () => {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    const client = new EC2Client({});
    (client.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      Instances: [
        {
          InstanceId: "i-abc123",
          Placement: { AvailabilityZone: "us-east-1a" },
        },
      ],
    });

    const { launchInstance } = await import("./activities.js");
    const result = await launchInstance(baseInput);
    expect(result).toEqual({
      instanceId: "i-abc123",
      availabilityZone: "us-east-1a",
    });
  });

  it("throws if no instance returned", async () => {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    const client = new EC2Client({});
    (client.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      Instances: [],
    });

    const { launchInstance } = await import("./activities.js");
    await expect(launchInstance(baseInput)).rejects.toThrow(
      "EC2 RunInstances returned no instance",
    );
  });
});

describe("deliverToken", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a token hash and stores via SSM", async () => {
    const { SSMClient } = await import("@aws-sdk/client-ssm");
    const client = new SSMClient({});
    (client.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    const { deliverToken } = await import("./activities.js");
    const result = await deliverToken({ agentId: baseInput.agentId });
    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
