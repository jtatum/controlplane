import type { FastifyInstance } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  emailMessages,
  emailAttachments,
  agents,
  channelEmail,
  channels,
  SendEmailSchema,
} from "@controlplane/shared";
import type { AgentEmailMessage } from "@controlplane/shared";
import { db } from "../db.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export async function agentEmailRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const { agentId } = (request.params ?? {}) as { agentId?: string };
    if (!agentId) return;

    if (request.authenticatedAgentId && request.authenticatedAgentId !== agentId) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  });

  app.get<{
    Params: { agentId: string };
    Querystring: { limit?: string; offset?: string };
  }>("/agents/:agentId/emails/inbox", async (request, reply) => {
    const { agentId } = request.params;
    const limit = Math.min(parsePositiveInt(request.query.limit, 50), 100);
    const offset = parsePositiveInt(request.query.offset, 0);

    const agent = await db
      .select({ id: agents.id, ownerId: agents.ownerId })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      return reply.status(404).send({ error: "Agent not found" });
    }

    if (request.authenticatedAgentId) {
      if (request.authenticatedAgentId !== agentId) {
        return reply.status(403).send({ error: "Forbidden" });
      }
    } else {
      const user = request.dbUser!;
      if (agent[0].ownerId !== user.id && user.role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
    }

    const messages = await db
      .select()
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.agentId, agentId),
          eq(emailMessages.visibleToAgent, true),
        ),
      )
      .orderBy(desc(emailMessages.createdAt))
      .limit(limit)
      .offset(offset);

    const messageIds = messages.map((m) => m.id);
    const attachmentsByMessage = new Map<
      string,
      { id: string; messageId: string; filename: string; contentType: string; sizeBytes: number; s3Key: string }[]
    >();

    if (messageIds.length > 0) {
      const allAttachments = await db
        .select({
          id: emailAttachments.id,
          messageId: emailAttachments.messageId,
          filename: emailAttachments.filename,
          contentType: emailAttachments.contentType,
          sizeBytes: emailAttachments.sizeBytes,
          s3Key: emailAttachments.s3Key,
        })
        .from(emailAttachments)
        .where(inArray(emailAttachments.messageId, messageIds));

      for (const a of allAttachments) {
        const list = attachmentsByMessage.get(a.messageId) ?? [];
        list.push(a);
        attachmentsByMessage.set(a.messageId, list);
      }
    }

    const result: AgentEmailMessage[] = messages.map((msg) => {
      const attachments = attachmentsByMessage.get(msg.id) ?? [];
      return {
        id: msg.id,
        direction: msg.direction,
        sender: msg.sender,
        recipients: msg.recipients,
        cc: msg.cc,
        subject: msg.subject,
        bodyText: msg.bodyText,
        bodyHtml: msg.bodyHtml,
        attachments: attachments.map((a) => ({
          id: a.id,
          messageId: a.messageId,
          filename: a.filename,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          downloadUrl: `/api/emails/attachments/${a.id}`,
        })),
        receivedAt: msg.createdAt.toISOString(),
      };
    });

    return { messages: result, limit, offset };
  });

  app.post<{
    Params: { agentId: string };
    Body: unknown;
  }>("/agents/:agentId/emails/send", async (request, reply) => {
    const { agentId } = request.params;

    const parsed = SendEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.issues,
      });
    }

    const agent = await db
      .select({ id: agents.id, ownerId: agents.ownerId })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      return reply.status(404).send({ error: "Agent not found" });
    }

    if (request.authenticatedAgentId) {
      if (request.authenticatedAgentId !== agentId) {
        return reply.status(403).send({ error: "Forbidden" });
      }
    } else {
      const user = request.dbUser!;
      if (agent[0].ownerId !== user.id && user.role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }
    }

    const emailChannel = await db
      .select({ mailboxAddress: channelEmail.mailboxAddress, outboundReview: channelEmail.outboundReview })
      .from(channelEmail)
      .innerJoin(channels, eq(channels.id, channelEmail.channelId))
      .where(and(eq(channels.agentId, agentId), eq(channels.type, "email")))
      .limit(1);

    if (emailChannel.length === 0) {
      return reply
        .status(400)
        .send({ error: "Email channel not configured for this agent" });
    }

    const needsReview = emailChannel[0].outboundReview;

    const [message] = await db
      .insert(emailMessages)
      .values({
        agentId,
        direction: "outbound",
        sender: emailChannel[0].mailboxAddress,
        recipients: parsed.data.recipients,
        cc: parsed.data.cc,
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
        bodyHtml: parsed.data.bodyHtml ?? null,
        reviewStatus: needsReview ? "pending" : "approved",
        visibleToAgent: true,
      })
      .returning({ id: emailMessages.id, reviewStatus: emailMessages.reviewStatus });

    return reply.status(201).send({
      id: message.id,
      reviewStatus: message.reviewStatus,
    });
  });
}
