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

export async function humanEmailRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      status?: string;
      agentId?: string;
      limit?: string;
      offset?: string;
    };
  }>("/email/review", async (request, reply) => {
    const status = request.query.status ?? "pending";
    const agentId = request.query.agentId;
    const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 100);
    const offset = parseInt(request.query.offset ?? "0", 10);

    if (!["pending", "approved", "rejected"].includes(status)) {
      return reply
        .status(400)
        .send({ error: "Invalid status filter. Use: pending, approved, rejected" });
    }

    const conditions = [
      eq(emailMessages.reviewStatus, status as "pending" | "approved" | "rejected"),
    ];

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
  }>("/email/:messageId", async (request, reply) => {
    const { messageId } = request.params;

    const [message] = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, messageId))
      .limit(1);

    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
    }

    const attachments = await db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.messageId, messageId));

    const result: EmailMessage & { attachments: typeof attachments } = {
      id: message.id,
      agentId: message.agentId,
      direction: message.direction,
      sender: message.sender,
      recipients: message.recipients,
      cc: message.cc,
      subject: message.subject,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      reviewStatus: message.reviewStatus,
      reviewedBy: message.reviewedBy,
      reviewedAt: message.reviewedAt?.toISOString() ?? null,
      reviewNote: message.reviewNote,
      visibleToAgent: message.visibleToAgent,
      sentAt: message.sentAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
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
  }>("/email/:messageId/review", async (request, reply) => {
    const { messageId } = request.params;

    const parsed = ReviewEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.issues,
      });
    }

    const [message] = await db
      .select({
        id: emailMessages.id,
        reviewStatus: emailMessages.reviewStatus,
      })
      .from(emailMessages)
      .where(eq(emailMessages.id, messageId))
      .limit(1);

    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
    }

    if (message.reviewStatus !== "pending") {
      return reply.status(409).send({
        error: `Message already reviewed as '${message.reviewStatus}'`,
      });
    }

    // TODO: extract userId from auth context once auth middleware exists
    const reviewerId = null;

    const [updated] = await db
      .update(emailMessages)
      .set({
        reviewStatus: parsed.data.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
        visibleToAgent:
          parsed.data.status === "approved" ? true : false,
        updatedAt: new Date(),
      })
      .where(eq(emailMessages.id, messageId))
      .returning({
        id: emailMessages.id,
        reviewStatus: emailMessages.reviewStatus,
        reviewedAt: emailMessages.reviewedAt,
      });

    return {
      id: updated.id,
      reviewStatus: updated.reviewStatus,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    };
  });
}
