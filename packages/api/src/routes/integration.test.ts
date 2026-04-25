import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";
import type { FastifyInstance } from "fastify";
import { setupTestDatabase, teardownTestDatabase, truncateAll } from "./integration-setup.js";

vi.mock("../temporal.js", () => ({
  getTemporalClient: vi.fn().mockResolvedValue({
    workflow: {
      start: vi.fn().mockResolvedValue({ firstExecutionRunId: "run-test-1" }),
    },
  }),
  TASK_QUEUE: "test-queue",
}));

let testUrl: string;
let pool: pg.Pool;
let app: FastifyInstance;

beforeAll(async () => {
  testUrl = await setupTestDatabase();
  process.env.DATABASE_URL = testUrl;
  process.env.DEV_MODE = "true";
  pool = new pg.Pool({ connectionString: testUrl });

  const { createApp } = await import("../app.js");
  app = await createApp();
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await teardownTestDatabase();
});

beforeEach(async () => {
  await truncateAll(pool);
});

async function createAgent(agentName: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/agents",
    payload: { name: `Agent ${agentName}`, agentName, environment: "dev" },
  });
  return res.json();
}

async function seedEmailChannel(agentId: string, opts: { outboundReview?: boolean } = {}) {
  const channelRes = await pool.query(
    "INSERT INTO channels (agent_id, type) VALUES ($1, 'email') RETURNING id",
    [agentId],
  );
  const channelId = channelRes.rows[0].id;
  await pool.query(
    `INSERT INTO channel_email (channel_id, mailbox_address, outbound_review)
     VALUES ($1, $2, $3)`,
    [channelId, `${agentId.slice(0, 8)}@openclaw.test`, opts.outboundReview ?? true],
  );
  return channelId;
}

async function seedEmailMessage(agentId: string, overrides: Record<string, unknown> = {}) {
  const defaults = {
    direction: "outbound",
    sender: "agent@openclaw.test",
    recipients: "{user@example.com}",
    subject: "Test email",
    body_text: "Hello world",
    review_status: "pending",
    visible_to_agent: false,
  };
  const vals = { ...defaults, ...overrides };
  const res = await pool.query(
    `INSERT INTO email_messages (agent_id, direction, sender, recipients, subject, body_text, review_status, visible_to_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [agentId, vals.direction, vals.sender, vals.recipients, vals.subject, vals.body_text, vals.review_status, vals.visible_to_agent],
  );
  return res.rows[0].id as string;
}

// ---------- Agents CRUD ----------

describe("POST /api/agents", () => {
  it("creates an agent and returns 201 with detail shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "Test Agent", agentName: "test-agent-01", environment: "dev" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toEqual(expect.any(String));
    expect(body.name).toBe("Test Agent");
    expect(body.agentName).toBe("test-agent-01");
    expect(body.environment).toBe("dev");
    expect(body.status).toBe("provisioning");
    expect(body.bedrockRegion).toBe("us-east-1");
    expect(body.instanceType).toBe("t4g.medium");
    expect(body.config).toBeDefined();
    expect(body.ownerId).toEqual(expect.any(String));
    expect(body.createdAt).toEqual(expect.any(String));
    expect(body.updatedAt).toEqual(expect.any(String));
    expect(body.provisionedAt).toBeNull();
    expect(body.ec2InstanceId).toBeNull();
    expect(body.privateIp).toBeNull();
    expect(body.availabilityZone).toBeNull();
  });

  it("returns 400 for invalid body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });
});

describe("GET /api/agents", () => {
  it("returns paginated list with { data, total, limit, offset }", async () => {
    await createAgent("agent-aaa");
    await createAgent("agent-bbb");

    const res = await app.inject({ method: "GET", url: "/api/agents" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);

    const summary = body.data[0];
    expect(summary).toHaveProperty("id");
    expect(summary).toHaveProperty("name");
    expect(summary).toHaveProperty("agentName");
    expect(summary).toHaveProperty("environment");
    expect(summary).toHaveProperty("status");
    expect(summary).toHaveProperty("createdAt");
    expect(summary).not.toHaveProperty("ownerId");
    expect(summary).not.toHaveProperty("config");
  });

  it("supports pagination with limit and offset", async () => {
    await createAgent("agent-one");
    await createAgent("agent-two");

    const res = await app.inject({ method: "GET", url: "/api/agents?limit=1&offset=1" });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(1);
  });

  it("filters by status", async () => {
    await createAgent("running-agent");
    const res = await app.inject({ method: "GET", url: "/api/agents?status=running" });
    expect(res.json().data).toHaveLength(0);
    expect(res.json().total).toBe(0);
  });

  it("filters by environment", async () => {
    await createAgent("dev-env-agent");
    // Create prod agent directly via inject with different env
    await app.inject({
      method: "POST",
      url: "/api/agents",
      payload: { name: "Prod", agentName: "prod-env-agent", environment: "prod" },
    });

    const res = await app.inject({ method: "GET", url: "/api/agents?environment=prod" });
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].environment).toBe("prod");
  });
});

describe("GET /api/agents/:id", () => {
  it("returns agent detail", async () => {
    const agent = await createAgent("detail-agent");

    const res = await app.inject({ method: "GET", url: `/api/agents/${agent.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(agent.id);
    expect(body.name).toBe("Agent detail-agent");
    expect(body.ownerId).toEqual(expect.any(String));
    expect(body.config).toBeDefined();
    expect(body.instanceType).toBe("t4g.medium");
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Agent not found");
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/not-a-uuid" });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/agents/:id", () => {
  it("updates agent name", async () => {
    const agent = await createAgent("patch-agent");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}`,
      payload: { name: "Updated Name" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Updated Name");
  });

  it("updates agent config", async () => {
    const agent = await createAgent("config-agent");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}`,
      payload: { config: { model: { temperature: 0.5 } } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().config.model.temperature).toBe(0.5);
  });

  it("returns 400 for empty body", async () => {
    const agent = await createAgent("empty-agent");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("No fields to update");
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/agents/00000000-0000-0000-0000-000000000000",
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 for terminated agent", async () => {
    const agent = await createAgent("terminated-agent");
    await pool.query("UPDATE agents SET status = 'terminated' WHERE id = $1", [agent.id]);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/agents/${agent.id}`,
      payload: { name: "Should Fail" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Cannot update a terminated agent");
  });
});

describe("POST /api/agents/:id/terminate", () => {
  it("initiates termination and returns stopping status", async () => {
    const agent = await createAgent("terminate-me");
    const res = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/terminate` });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("stopping");
    expect(res.json().id).toBe(agent.id);
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.inject({ method: "POST", url: "/api/agents/00000000-0000-0000-0000-000000000000/terminate" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 for already terminated agent", async () => {
    const agent = await createAgent("already-done");
    await pool.query("UPDATE agents SET status = 'terminated' WHERE id = $1", [agent.id]);
    const res = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/terminate` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("Cannot terminate agent");
    expect(res.json().allowedTransitions).toEqual([]);
  });

  it("returns 409 for already stopping agent", async () => {
    const agent = await createAgent("stopping-agent");
    await pool.query("UPDATE agents SET status = 'stopping' WHERE id = $1", [agent.id]);
    const res = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/terminate` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("Cannot terminate agent");
  });

  it("returns 409 for agent in stopped status", async () => {
    const agent = await createAgent("stopped-agent");
    await pool.query("UPDATE agents SET status = 'stopped' WHERE id = $1", [agent.id]);
    const res = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/terminate` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("Cannot terminate agent");
  });

  it("returns 409 for agent in requested status", async () => {
    const agent = await createAgent("requested-agent");
    await pool.query("UPDATE agents SET status = 'requested' WHERE id = $1", [agent.id]);
    const res = await app.inject({ method: "POST", url: `/api/agents/${agent.id}/terminate` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("Cannot terminate agent");
  });
});

// ---------- Email review routes ----------

describe("GET /api/emails/review", () => {
  it("returns paginated review queue with { messages, total, limit, offset }", async () => {
    const agent = await createAgent("review-agent");
    await seedEmailMessage(agent.id);
    await seedEmailMessage(agent.id, { subject: "Second email" });

    const res = await app.inject({ method: "GET", url: "/api/emails/review" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("messages");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");
    expect(body.messages).toHaveLength(2);
    expect(body.total).toBe(2);

    const msg = body.messages[0];
    expect(msg).toHaveProperty("id");
    expect(msg).toHaveProperty("agentId");
    expect(msg).toHaveProperty("agentName");
    expect(msg).toHaveProperty("direction");
    expect(msg).toHaveProperty("sender");
    expect(msg).toHaveProperty("recipients");
    expect(msg).toHaveProperty("subject");
    expect(msg).toHaveProperty("reviewStatus");
    expect(msg).toHaveProperty("createdAt");
    expect(msg.reviewStatus).toBe("pending");
  });

  it("filters by status", async () => {
    const agent = await createAgent("filter-agent");
    await seedEmailMessage(agent.id, { review_status: "pending" });
    await seedEmailMessage(agent.id, { review_status: "approved", visible_to_agent: true });

    const pending = await app.inject({ method: "GET", url: "/api/emails/review?status=pending" });
    expect(pending.json().messages).toHaveLength(1);

    const approved = await app.inject({ method: "GET", url: "/api/emails/review?status=approved" });
    expect(approved.json().messages).toHaveLength(1);
  });

  it("returns 400 for invalid status filter", async () => {
    const res = await app.inject({ method: "GET", url: "/api/emails/review?status=invalid" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Invalid status");
  });

  it("supports pagination", async () => {
    const agent = await createAgent("page-agent");
    await seedEmailMessage(agent.id, { subject: "Email 1" });
    await seedEmailMessage(agent.id, { subject: "Email 2" });
    await seedEmailMessage(agent.id, { subject: "Email 3" });

    const page1 = await app.inject({ method: "GET", url: "/api/emails/review?limit=2&offset=0" });
    expect(page1.json().messages).toHaveLength(2);
    expect(page1.json().total).toBe(3);

    const page2 = await app.inject({ method: "GET", url: "/api/emails/review?limit=2&offset=2" });
    expect(page2.json().messages).toHaveLength(1);
  });

  it("filters by agentId", async () => {
    const agent1 = await createAgent("agent-one-email");
    const agent2 = await createAgent("agent-two-email");
    await seedEmailMessage(agent1.id);
    await seedEmailMessage(agent2.id);

    const res = await app.inject({ method: "GET", url: `/api/emails/review?agentId=${agent1.id}` });
    expect(res.json().messages).toHaveLength(1);
    expect(res.json().messages[0].agentId).toBe(agent1.id);
  });
});

describe("GET /api/emails/:messageId", () => {
  it("returns message detail with attachments", async () => {
    const agent = await createAgent("detail-email-agent");
    const messageId = await seedEmailMessage(agent.id);
    await pool.query(
      `INSERT INTO email_attachments (message_id, filename, content_type, size_bytes, s3_key)
       VALUES ($1, 'doc.pdf', 'application/pdf', 1024, 'attachments/doc.pdf')`,
      [messageId],
    );

    const res = await app.inject({ method: "GET", url: `/api/emails/${messageId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(messageId);
    expect(body.subject).toBe("Test email");
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].filename).toBe("doc.pdf");
    expect(body.attachments[0].sizeBytes).toBe(1024);
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.inject({ method: "GET", url: "/api/emails/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Message not found");
  });
});

describe("POST /api/emails/:messageId/review", () => {
  it("approves a pending message", async () => {
    const agent = await createAgent("approve-agent");
    const messageId = await seedEmailMessage(agent.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/emails/${messageId}/review`,
      payload: { status: "approved", note: "Looks good" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(messageId);
    expect(res.json().reviewStatus).toBe("approved");
    expect(res.json().reviewedAt).toEqual(expect.any(String));

    const dbCheck = await pool.query("SELECT visible_to_agent FROM email_messages WHERE id = $1", [messageId]);
    expect(dbCheck.rows[0].visible_to_agent).toBe(true);
  });

  it("rejects a pending message", async () => {
    const agent = await createAgent("reject-agent");
    const messageId = await seedEmailMessage(agent.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/emails/${messageId}/review`,
      payload: { status: "rejected", note: "Not appropriate" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().reviewStatus).toBe("rejected");

    const dbCheck = await pool.query("SELECT visible_to_agent FROM email_messages WHERE id = $1", [messageId]);
    expect(dbCheck.rows[0].visible_to_agent).toBe(false);
  });

  it("returns 409 for already reviewed message", async () => {
    const agent = await createAgent("conflict-agent");
    const messageId = await seedEmailMessage(agent.id, { review_status: "approved", visible_to_agent: true });

    const res = await app.inject({
      method: "POST",
      url: `/api/emails/${messageId}/review`,
      payload: { status: "rejected" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("already reviewed");
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/emails/00000000-0000-0000-0000-000000000000/review",
      payload: { status: "approved" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid review body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/emails/some-id/review",
      payload: { status: "invalid" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
  });
});

// ---------- Agent email routes ----------

describe("GET /api/agents/:agentId/emails/inbox", () => {
  it("returns visible messages with attachments", async () => {
    const agent = await createAgent("inbox-agent");
    const msgId = await seedEmailMessage(agent.id, {
      direction: "inbound",
      visible_to_agent: true,
      review_status: "approved",
    });
    await pool.query(
      `INSERT INTO email_attachments (message_id, filename, content_type, size_bytes, s3_key)
       VALUES ($1, 'report.csv', 'text/csv', 512, 'attachments/report.csv')`,
      [msgId],
    );
    await seedEmailMessage(agent.id, { direction: "inbound", visible_to_agent: false, review_status: "pending" });

    const res = await app.inject({ method: "GET", url: `/api/agents/${agent.id}/emails/inbox` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("messages");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].attachments).toHaveLength(1);
    expect(body.messages[0].attachments[0].filename).toBe("report.csv");
    expect(body.messages[0]).toHaveProperty("receivedAt");
    expect(body.messages[0]).not.toHaveProperty("reviewStatus");
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/00000000-0000-0000-0000-000000000000/emails/inbox" });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/agents/:agentId/emails/send", () => {
  it("creates outbound email with pending review", async () => {
    const agent = await createAgent("send-agent");
    await seedEmailChannel(agent.id, { outboundReview: true });

    const res = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/emails/send`,
      payload: { recipients: ["user@example.com"], subject: "Hello", bodyText: "Test" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toEqual(expect.any(String));
    expect(res.json().reviewStatus).toBe("pending");
  });

  it("creates approved email when outbound review disabled", async () => {
    const agent = await createAgent("no-review-agent");
    await seedEmailChannel(agent.id, { outboundReview: false });

    const res = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/emails/send`,
      payload: { recipients: ["user@example.com"], subject: "Auto", bodyText: "No review" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().reviewStatus).toBe("approved");
  });

  it("returns 400 when no email channel configured", async () => {
    const agent = await createAgent("no-channel-agent");
    const res = await app.inject({
      method: "POST",
      url: `/api/agents/${agent.id}/emails/send`,
      payload: { recipients: ["user@example.com"], subject: "Test", bodyText: "Hello" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Email channel not configured");
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/00000000-0000-0000-0000-000000000000/emails/send",
      payload: { recipients: ["user@example.com"], subject: "Test", bodyText: "Hello" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/some-id/emails/send",
      payload: { recipients: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});
