import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { users } from "@controlplane/shared";
import agentRoutes from "./agents.js";

vi.mock("../db.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../temporal.js", () => ({
  getTemporalClient: vi.fn().mockResolvedValue({
    workflow: {
      start: vi.fn().mockResolvedValue({ firstExecutionRunId: "run-1" }),
    },
  }),
  TASK_QUEUE: "test-queue",
}));

vi.mock("../audit.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../ownership.js", () => ({
  verifyAgentOwnership: vi.fn(),
}));

import { db } from "../db.js";
import { verifyAgentOwnership } from "../ownership.js";

const mockedDb = vi.mocked(db);
const mockedVerify = vi.mocked(verifyAgentOwnership);

function buildApp() {
  const app = Fastify();
  app.decorateRequest("dbUser", null);
  app.addHook("onRequest", async (request) => {
    request.dbUser = { id: "user-1", role: "user" } as unknown as typeof users.$inferSelect;
  });
  app.register(agentRoutes);
  return app;
}

describe("agent routes ownership", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  describe("POST /agents", () => {
    it("returns 409 when agentName is already taken", async () => {
      const activeAgentSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      const versionSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([
            { id: "v-1", amiId: "ami-123", version: "1.0.0" },
          ]),
      };
      mockedDb.select
        .mockReturnValueOnce(activeAgentSelect as unknown as ReturnType<typeof db.select>)
        .mockReturnValueOnce(versionSelect as unknown as ReturnType<typeof db.select>);

      const uniqueError: Error & { code?: string; constraint?: string } =
        Object.assign(new Error("unique violation"), {
          code: "23505",
          constraint: "idx_agents_agent_name",
        });

      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(uniqueError),
      };
      mockedDb.insert.mockReturnValueOnce(insertChain as unknown as ReturnType<typeof db.insert>);

      const res = await app.inject({
        method: "POST",
        url: "/agents",
        payload: {
          name: "My Agent",
          agentName: "taken-name",
          environment: "dev",
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe("Agent name already in use");
    });
  });

  describe("PATCH /agents/:id", () => {
    it("returns 403 when user does not own agent", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(403).send({ error: "Forbidden" });
        return null;
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/agents/00000000-0000-0000-0000-000000000001",
        payload: { name: "new-name" },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "Forbidden" });
    });

    it("returns 404 when agent not found", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(404).send({ error: "Agent not found" });
        return null;
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/agents/00000000-0000-0000-0000-000000000001",
        payload: { name: "new-name" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Agent not found" });
    });

    it("updates agent when user owns it", async () => {
      mockedVerify.mockResolvedValueOnce({
        id: "00000000-0000-0000-0000-000000000001",
        ownerId: "user-1",
        status: "running",
        versionId: null,
      } as unknown as Awaited<ReturnType<typeof verifyAgentOwnership>>);

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "00000000-0000-0000-0000-000000000001",
            ownerId: "user-1",
            name: "new-name",
            agentName: "test",
            environment: "dev",
            status: "running",
            instanceType: "t4g.medium",
            bedrockRegion: "us-east-1",
            versionId: null,
            ec2InstanceId: null,
            privateIp: null,
            availabilityZone: null,
            config: {},
            provisionedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };
      mockedDb.update.mockReturnValueOnce(updateChain as unknown as ReturnType<typeof db.update>);

      const res = await app.inject({
        method: "PATCH",
        url: "/agents/00000000-0000-0000-0000-000000000001",
        payload: { name: "new-name" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("new-name");
    });
  });

  describe("POST /agents/:id/terminate", () => {
    it("returns 403 when user does not own agent", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(403).send({ error: "Forbidden" });
        return null;
      });

      const res = await app.inject({
        method: "POST",
        url: "/agents/00000000-0000-0000-0000-000000000001/terminate",
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "Forbidden" });
    });

    it("returns 404 when agent not found", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(404).send({ error: "Agent not found" });
        return null;
      });

      const res = await app.inject({
        method: "POST",
        url: "/agents/00000000-0000-0000-0000-000000000001/terminate",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Agent not found" });
    });
  });
});
