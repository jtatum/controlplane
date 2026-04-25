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
    TerminateInstancesCommand: vi.fn((input: unknown) => ({
      _type: "TerminateInstances",
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

const mockPoolQuery = vi.fn();
vi.mock("pg", () => ({
  default: {
    Pool: vi.fn(() => ({ query: mockPoolQuery })),
  },
}));

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

describe("cleanupAgentData", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPoolQuery.mockReset();
  });

  it("deletes channels, skills, and archives messages", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rowCount: 5 });

    const { cleanupAgentData } = await import("./activities.js");
    const result = await cleanupAgentData({ agentId: baseInput.agentId });

    expect(result).toEqual({
      deletedChannels: 2,
      deletedSkills: 3,
      archivedMessages: 5,
    });

    expect(mockPoolQuery).toHaveBeenCalledTimes(3);
    expect(mockPoolQuery.mock.calls[0][0]).toContain("DELETE FROM channels");
    expect(mockPoolQuery.mock.calls[1][0]).toContain(
      "DELETE FROM agent_skills",
    );
    expect(mockPoolQuery.mock.calls[2][0]).toContain("UPDATE email_messages");
  });

  it("returns zeros when no related data exists", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 });

    const { cleanupAgentData } = await import("./activities.js");
    const result = await cleanupAgentData({ agentId: baseInput.agentId });

    expect(result).toEqual({
      deletedChannels: 0,
      deletedSkills: 0,
      archivedMessages: 0,
    });
  });
});
