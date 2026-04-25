import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { users } from "@controlplane/shared";
import { auditLogRoutes } from "./audit-log.js";

vi.mock("../db.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../ownership.js", () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

import { db } from "../db.js";
import { isAdmin } from "../ownership.js";

const mockedDb = vi.mocked(db);
const mockedIsAdmin = vi.mocked(isAdmin);

function mockEmpty() {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
  };
  const countChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
  };
  mockedDb.select
    .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof db.select>)
    .mockReturnValueOnce(countChain as unknown as ReturnType<typeof db.select>);
}

function buildApp() {
  const app = Fastify();
  app.decorateRequest("dbUser", null);
  app.addHook("onRequest", async (request) => {
    request.dbUser = { id: "user-1", role: "admin" } as unknown as typeof users.$inferSelect;
  });
  app.register(auditLogRoutes);
  return app;
}

describe("audit-log routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsAdmin.mockReturnValue(true);
  });

  describe("GET /audit-log", () => {
    it("returns empty list with defaults", async () => {
      mockEmpty();
      const app = buildApp();
      await app.ready();

      const res = await app.inject({
        method: "GET",
        url: "/audit-log",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);

      await app.close();
    });

    it("accepts action filter", async () => {
      mockEmpty();
      const app = buildApp();
      await app.ready();

      const res = await app.inject({
        method: "GET",
        url: "/audit-log?action=agent.create",
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });

    it("returns entries when present", async () => {
      const now = new Date();
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([
          {
            id: "entry-1",
            actorId: "user-1",
            actorType: "user",
            actorEmail: "dev@openclaw.local",
            agentId: "agent-1",
            action: "agent.create",
            resourceType: "agent",
            resourceId: "agent-1",
            detail: { name: "Test Agent" },
            ipAddress: "127.0.0.1",
            createdAt: now,
          },
        ]),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      };
      mockedDb.select
        .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof db.select>)
        .mockReturnValueOnce(countChain as unknown as ReturnType<typeof db.select>);

      const app = buildApp();
      await app.ready();

      const res = await app.inject({
        method: "GET",
        url: "/audit-log",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].action).toBe("agent.create");
      expect(body.data[0].actorEmail).toBe("dev@openclaw.local");
      expect(body.total).toBe(1);

      await app.close();
    });

    it("non-admin: filters to owned agents only", async () => {
      mockedIsAdmin.mockReturnValue(false);

      const now = new Date();
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([
          {
            id: "entry-1",
            actorId: "user-1",
            actorType: "user",
            actorEmail: "dev@openclaw.local",
            agentId: "agent-1",
            action: "agent.create",
            resourceType: "agent",
            resourceId: "agent-1",
            detail: {},
            ipAddress: "127.0.0.1",
            createdAt: now,
          },
        ]),
      };
      const countChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      };
      mockedDb.select
        .mockReturnValueOnce(selectChain as unknown as ReturnType<typeof db.select>)
        .mockReturnValueOnce(countChain as unknown as ReturnType<typeof db.select>);

      const app = buildApp();
      await app.ready();

      const res = await app.inject({
        method: "GET",
        url: "/audit-log",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(selectChain.where).toHaveBeenCalled();
      expect(countChain.where).toHaveBeenCalled();
      await app.close();
    });

    it("admin: sees all audit logs without ownership filter", async () => {
      mockedIsAdmin.mockReturnValue(true);
      mockEmpty();

      const app = buildApp();
      await app.ready();

      const res = await app.inject({
        method: "GET",
        url: "/audit-log",
      });

      expect(res.statusCode).toBe(200);
      expect(mockedIsAdmin).toHaveBeenCalled();
      await app.close();
    });
  });
});
