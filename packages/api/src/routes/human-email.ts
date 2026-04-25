import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  emailMessages,
  emailAttachments,
  agents,
  ReviewEmailSchema,
} from "@controlplane/shared";
import type { EmailMessage } from "@controlplane/shared";
import { db } from "../db.js";
import { writeAuditLog } from "../audit.js";
import { isAdmin } from "../ownership.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export async function humanEmailRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      status?: string;
      agentId?: string;
      limit?: string;
      offset?: string;
    };
  }>("/emails/review", async (request, reply) => {
    const status = request.query.status ?? "pending";
    const agentId = request.query.agentId;
    const limit = Math.min(parsePositiveInt(request.query.limit, 50), 100);
    const offset = parsePositiveInt(request.query.offset, 0);

    if (!["pending", "approved", "rejected"].includes(status)) {
      return reply
        .status(400)
        .send({ error: "Invalid status filter. Use: pending, approved, rejected" });
    }

    const user = request.dbUser!;
    const conditions = [
      eq(emailMessages.reviewStatus, status as "pending" | "approved" | "rejected"),
    ];

    if (!isAdmin(request)) {
      conditions.push(eq(agents.ownerId, user.id));
    }

    if (agentId) {
      conditions.push(eq(emailMessages.agentId, agentId));
    }

    const [messages, countResult] = await Promise.all([
      db
        .select({
          id: emailMessages.id,
          agentId: emailMessages.agentId,
          direction: emailMessages.direction,
          sender: emailMessages.sender,
          recipients: emailMessages.recipients,
          cc: emailMessages.cc,
          subject: emailMessages.subject,
          bodyText: emailMessages.bodyText,
          bodyHtml: emailMessages.bodyHtml,
          reviewStatus: emailMessages.reviewStatus,
          reviewedBy: emailMessages.reviewedBy,
          reviewedAt: emailMessages.reviewedAt,
          reviewNote: emailMessages.reviewNote,
          visibleToAgent: emailMessages.visibleToAgent,
          sentAt: emailMessages.sentAt,
          createdAt: emailMessages.createdAt,
          agentName: agents.agentName,
        })
        .from(emailMessages)
        .innerJoin(agents, eq(agents.id, emailMessages.agentId))
        .where(and(...conditions))
        .orderBy(desc(emailMessages.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(emailMessages)
        .innerJoin(agents, eq(agents.id, emailMessages.agentId))
        .where(and(...conditions)),
    ]);

    const result = messages.map((msg) => ({
      id: msg.id,
      agentId: msg.agentId,
      agentName: msg.agentName,
      direction: msg.direction,
      sender: msg.sender,
      recipients: msg.recipients,
      cc: msg.cc,
      subject: msg.subject,
      bodyText: msg.bodyText,
      bodyHtml: msg.bodyHtml,
      reviewStatus: msg.reviewStatus,
      reviewedBy: msg.reviewedBy,
      reviewedAt: msg.reviewedAt?.toISOString() ?? null,
      reviewNote: msg.reviewNote,
      visibleToAgent: msg.visibleToAgent,
      sentAt: msg.sentAt?.toISOString() ?? null,
      createdAt: msg.createdAt.toISOString(),
    }));

    return {
      messages: result,
      total: Number(countResult[0].count),
      limit,
      offset,
    };
  });

  app.get<{
    Params: { messageId: string };
  }>("/emails/:messageId", async (request, reply) => {
    const { messageId } = request.params;
    const user = request.dbUser!;

    const messageConditions = [eq(emailMessages.id, messageId)];
    if (!isAdmin(request)) {
      messageConditions.push(eq(agents.ownerId, user.id));
    }

    const [message] = await db
      .select({ msg: emailMessages })
      .from(emailMessages)
      .innerJoin(agents, eq(agents.id, emailMessages.agentId))
      .where(and(...messageConditions))
      .limit(1);

    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
    }

    const attachments = await db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.messageId, messageId));

    const m = message.msg;
    const result: EmailMessage & { attachments: typeof attachments } = {
      id: m.id,
      agentId: m.agentId,
      direction: m.direction,
      sender: m.sender,
      recipients: m.recipients,
      cc: m.cc,
      subject: m.subject,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      reviewStatus: m.reviewStatus,
      reviewedBy: m.reviewedBy,
      reviewedAt: m.reviewedAt?.toISOString() ?? null,
      reviewNote: m.reviewNote,
      visibleToAgent: m.visibleToAgent,
      sentAt: m.sentAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      attachments: attachments.map((a) => ({
        ...a,
        createdAt: a.createdAt,
      })),
    };

    return result;
  });

  app.post<{
    Params: { messageId: string };
    Body: unknown;
  }>("/emails/:messageId/review", async (request, reply) => {
    const { messageId } = request.params;
    const user = request.dbUser!;

    const parsed = ReviewEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.issues,
      });
    }

    if (!isAdmin(request)) {
      const [owned] = await db
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .innerJoin(agents, eq(agents.id, emailMessages.agentId))
        .where(
          and(eq(emailMessages.id, messageId), eq(agents.ownerId, user.id)),
        )
        .limit(1);

      if (!owned) {
        return reply.status(404).send({ error: "Message not found" });
      }
    }

    const [updated] = await db
      .update(emailMessages)
      .set({
        reviewStatus: parsed.data.status,
        reviewedBy: request.dbUser?.id ?? null,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
        visibleToAgent: parsed.data.status === "approved",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailMessages.id, messageId),
          eq(emailMessages.reviewStatus, "pending"),
        ),
      )
      .returning({
        id: emailMessages.id,
        agentId: emailMessages.agentId,
        reviewStatus: emailMessages.reviewStatus,
        reviewedAt: emailMessages.reviewedAt,
      });

    if (!updated) {
      const [existing] = await db
        .select({ id: emailMessages.id, reviewStatus: emailMessages.reviewStatus })
        .from(emailMessages)
        .where(eq(emailMessages.id, messageId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Message not found" });
      }

      return reply.status(409).send({
        error: `Message already reviewed as '${existing.reviewStatus}'`,
      });
    }

    await writeAuditLog({
      actorId: request.dbUser?.id ?? "",
      action: `email.review.${parsed.data.status}`,
      resourceType: "email",
      resourceId: messageId,
      agentId: updated.agentId,
      detail: { status: parsed.data.status, note: parsed.data.note ?? null },
      ipAddress: request.ip,
    });

    return {
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    };
  });
}
