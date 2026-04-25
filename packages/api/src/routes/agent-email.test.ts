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

vi.mock("../ownership.js", () => ({
  verifyAgentOwnership: vi
    .fn()
    .mockResolvedValue({ id: "agent-1", ownerId: "user-1" }),
}));

import { db } from "../db.js";
import { verifyAgentOwnership } from "../ownership.js";

const mockedDb = vi.mocked(db);
const mockedVerify = vi.mocked(verifyAgentOwnership);

function buildApp() {
  const app = Fastify();
  app.register(agentEmailRoutes);
  return app;
}

describe("agent email routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockedVerify.mockResolvedValue({ id: "agent-1", ownerId: "user-1" } as any);
    app = buildApp();
    await app.ready();
  });

  describe("GET /agents/:agentId/emails/inbox", () => {
    it("returns 404 when agent not found", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(404).send({ error: "Agent not found" });
        return null;
      });

      const res = await app.inject({
        method: "GET",
        url: "/agents/00000000-0000-0000-0000-000000000001/emails/inbox",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Agent not found" });
    });

    it("returns 403 when user does not own agent", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(403).send({ error: "Forbidden" });
        return null;
      });

      const res = await app.inject({
        method: "GET",
        url: "/agents/agent-1/emails/inbox",
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "Forbidden" });
    });

    it("returns messages with batch-loaded attachments", async () => {
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
          {
            id: "msg-2",
            direction: "inbound",
            sender: "other@example.com",
            recipients: ["agent@openclaw.disney.com"],
            cc: [],
            subject: "Second",
            bodyText: "Another",
            bodyHtml: null,
            createdAt: now,
          },
        ]),
      };

      const attachmentsSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: "att-1",
            messageId: "msg-1",
            filename: "file.pdf",
            contentType: "application/pdf",
            sizeBytes: 1024,
            s3Key: "attachments/att-1",
          },
        ]),
      };

      mockedDb.select
        .mockReturnValueOnce(messagesSelect as any)
        .mockReturnValueOnce(attachmentsSelect as any);

      const res = await app.inject({
        method: "GET",
        url: "/agents/agent-1/emails/inbox",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].attachments).toHaveLength(1);
      expect(body.messages[0].attachments[0].filename).toBe("file.pdf");
      expect(body.messages[1].attachments).toHaveLength(0);
      expect(mockedDb.select).toHaveBeenCalledTimes(2);
    });

    it("treats NaN limit/offset as defaults", async () => {
      const messagesSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      mockedDb.select.mockReturnValueOnce(messagesSelect as any);

      const res = await app.inject({
        method: "GET",
        url: "/agents/agent-1/emails/inbox?limit=abc&offset=-5",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
    });
  });

  describe("POST /agents/:agentId/emails/send", () => {
    it("returns 400 for invalid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/emails/send",
        payload: { recipients: [] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    });

    it("returns 404 when agent not found", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(404).send({ error: "Agent not found" });
        return null;
      });

      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/emails/send",
        payload: {
          recipients: ["user@example.com"],
          subject: "Test",
          bodyText: "Hello",
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when user does not own agent", async () => {
      mockedVerify.mockImplementationOnce(async (_id, _req, reply) => {
        reply.code(403).send({ error: "Forbidden" });
        return null;
      });

      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/emails/send",
        payload: {
          recipients: ["user@example.com"],
          subject: "Test",
          bodyText: "Hello",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: "Forbidden" });
    });

    it("creates a pending message when outboundReview is true", async () => {
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

      mockedDb.select.mockReturnValueOnce(channelSelect as any);
      mockedDb.insert.mockReturnValueOnce(insertChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/emails/send",
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

    it("creates an approved message when outboundReview is false", async () => {
      const channelSelect = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { mailboxAddress: "agent@openclaw.disney.com", outboundReview: false },
        ]),
      };

      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "msg-new", reviewStatus: "approved" },
        ]),
      };

      mockedDb.select.mockReturnValueOnce(channelSelect as any);
      mockedDb.insert.mockReturnValueOnce(insertChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/agents/agent-1/emails/send",
        payload: {
          recipients: ["user@example.com"],
          subject: "Test",
          bodyText: "Hello",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe("msg-new");
      expect(res.json().reviewStatus).toBe("approved");
    });
  });
});
