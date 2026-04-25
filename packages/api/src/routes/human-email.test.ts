import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { humanEmailRoutes } from "./human-email.js";

vi.mock("../db.js", () => {
  return {
    db: {
      select: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock("../audit.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "../db.js";

const mockedDb = vi.mocked(db);

function buildApp() {
  const app = Fastify();
  app.decorateRequest("userId", "reviewer-1");
  app.register(humanEmailRoutes);
  return app;
}

describe("human email routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildApp();
    await app.ready();
  });

  describe("GET /emails/review", () => {
    it("returns 400 for invalid status filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/emails/review?status=invalid",
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns paginated review queue", async () => {
      const now = new Date();
      const messagesSelect = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([
          {
            id: "msg-1",
            agentId: "agent-1",
            agentName: "test-agent",
            direction: "outbound",
            sender: "agent@openclaw.disney.com",
            recipients: ["user@example.com"],
            cc: [],
            subject: "Hello",
            bodyText: "Hi",
            bodyHtml: null,
            reviewStatus: "pending",
            reviewedBy: null,
            reviewedAt: null,
            reviewNote: null,
            visibleToAgent: true,
            sentAt: null,
            createdAt: now,
          },
        ]),
      };

      const countSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      };

      mockedDb.select
        .mockReturnValueOnce(messagesSelect as any)
        .mockReturnValueOnce(countSelect as any);

      const res = await app.inject({
        method: "GET",
        url: "/emails/review",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.messages[0].reviewStatus).toBe("pending");
    });

    it("treats NaN limit/offset as defaults", async () => {
      const messagesSelect = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const countSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      };

      mockedDb.select
        .mockReturnValueOnce(messagesSelect as any)
        .mockReturnValueOnce(countSelect as any);

      const res = await app.inject({
        method: "GET",
        url: "/emails/review?limit=abc&offset=xyz",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
    });
  });

  describe("GET /emails/:messageId", () => {
    it("returns 404 for unknown message", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockedDb.select.mockReturnValueOnce(selectChain as any);

      const res = await app.inject({
        method: "GET",
        url: "/emails/00000000-0000-0000-0000-000000000001",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns message with attachments", async () => {
      const now = new Date();
      const messageSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "msg-1",
            agentId: "agent-1",
            direction: "inbound",
            sender: "user@example.com",
            recipients: ["agent@openclaw.disney.com"],
            cc: [],
            subject: "Test",
            bodyText: "Body",
            bodyHtml: null,
            reviewStatus: "approved",
            reviewedBy: "reviewer-1",
            reviewedAt: now,
            reviewNote: "Looks good",
            visibleToAgent: true,
            sentAt: null,
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
            filename: "report.pdf",
            contentType: "application/pdf",
            sizeBytes: 1024,
            s3Key: "attachments/att-1",
            createdAt: now,
          },
        ]),
      };

      mockedDb.select
        .mockReturnValueOnce(messageSelect as any)
        .mockReturnValueOnce(attachmentsSelect as any);

      const res = await app.inject({
        method: "GET",
        url: "/emails/msg-1",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe("msg-1");
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].filename).toBe("report.pdf");
    });
  });

  describe("POST /emails/:messageId/review", () => {
    it("returns 400 for invalid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/emails/msg-1/review",
        payload: { status: "invalid" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for unknown message", async () => {
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockedDb.update.mockReturnValueOnce(updateChain as any);

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockedDb.select.mockReturnValueOnce(selectChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/emails/msg-1/review",
        payload: { status: "approved" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 409 for already reviewed message", async () => {
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockedDb.update.mockReturnValueOnce(updateChain as any);

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "msg-1", reviewStatus: "approved" },
        ]),
      };
      mockedDb.select.mockReturnValueOnce(selectChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/emails/msg-1/review",
        payload: { status: "rejected", note: "Too late" },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain("already reviewed");
    });

    it("approves a pending message", async () => {
      const now = new Date();
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "msg-1", agentId: "agent-1", reviewStatus: "approved", reviewedAt: now },
        ]),
      };
      mockedDb.update.mockReturnValueOnce(updateChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/emails/msg-1/review",
        payload: { status: "approved", note: "Looks good" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().reviewStatus).toBe("approved");
    });

    it("rejects a pending message", async () => {
      const now = new Date();
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          { id: "msg-1", agentId: "agent-1", reviewStatus: "rejected", reviewedAt: now },
        ]),
      };
      mockedDb.update.mockReturnValueOnce(updateChain as any);

      const res = await app.inject({
        method: "POST",
        url: "/emails/msg-1/review",
        payload: { status: "rejected", note: "Not appropriate" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().reviewStatus).toBe("rejected");
    });
  });
});
