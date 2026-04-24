import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { agentEmailRoutes } from "./agent-email.js";

vi.mock("../db.js", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };

  const insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([
      { id: "msg-1", reviewStatus: "pending" },
    ]),
  };

  return {
    db: {
      select: vi.fn(() => ({ ...selectChain })),
      insert: vi.fn(() => ({ ...insertChain })),
    },
  };
});

import { db } from "../db.js";

const mockedDb = vi.mocked(db);

function buildApp() {
  const app = Fastify();
  app.register(agentEmailRoutes);
  return app;
}

describe("agent email routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  describe("GET /agents/:agentId/email/inbox", () => {
    it("returns 404 when agent not found", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockedDb.select.mockReturnValueOnce(selectChain as any);

      const res = await app.inject({
        method: "GET",
        url: "/agents/00000000-0000-0000-0000-000000000001/email/inbox",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Agent not found" });
    });

    it("returns messages for a valid agent", async () => {
      const agentSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "agent-1" }]),
      };

      const now = new Date();
      const messagesSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([
          {
            id: "msg-1",
            direction: "inbound",
            sender: "user@example.com",
            recipients: ["agent@openclaw.disney.com"],
            cc: [],
            subject: "Hello",
            bodyText: "Hi there",
            bodyHtml: null,
            createdAt: now,
          },
        ]),
      };

      const attachmentsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockedDb.select
        .mockReturnValueOnce(agentSelect as any)
        .mockReturnValueOnce(messagesSelect as any)
        .mockReturnValueOnce(attachmentsSelect as any);

      const res = await app.inject({
        method: "GET",
        url: "/agents/agent-1/email/inbox",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].id).toBe("msg-1");
      expect(body.messages[0].direction).toBe("inbound");
    });
  });

  describe("POST /agents/:agentId/email/send", () => {
    it("returns 400 for invalid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/email/send",
        payload: { recipients: [] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 404 when agent not found", async () => {
      const agentSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockedDb.select.mockReturnValueOnce(agentSelect as any);

      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/email/send",
        payload: {
          recipients: ["user@example.com"],
          subject: "Test",
          bodyText: "Hello",
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it("creates a message when valid", async () => {
      const agentSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "agent-1" }]),
      };

      const channelSelect = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { mailboxAddress: "agent@openclaw.disney.com", outboundReview: true },
        ]),
      };

      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "msg-new", reviewStatus: "pending" },
        ]),
      };

      mockedDb.select
        .mockReturnValueOnce(agentSelect as any)
        .mockReturnValueOnce(channelSelect as any);
      mockedDb.insert.mockReturnValueOnce(insertChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/email/send",
        payload: {
          recipients: ["user@example.com"],
          subject: "Test",
          bodyText: "Hello",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe("msg-new");
      expect(res.json().reviewStatus).toBe("pending");
    });
  });
});
