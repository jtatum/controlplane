import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
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

export async function agentEmailRoutes(app: FastifyInstance) {
  app.get<{
    Params: { agentId: string };
    Querystring: { limit?: string; offset?: string };
  }>("/agents/:agentId/email/inbox", async (request, reply) => {
    const { agentId } = request.params;
    const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 100);
    const offset = parseInt(request.query.offset ?? "0", 10);

    const agent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      return reply.status(404).send({ error: "Agent not found" });
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

    const result: AgentEmailMessage[] = await Promise.all(
      messages.map(async (msg) => {
        const attachments = await db
          .select({
            id: emailAttachments.id,
            messageId: emailAttachments.messageId,
            filename: emailAttachments.filename,
            contentType: emailAttachments.contentType,
            sizeBytes: emailAttachments.sizeBytes,
            s3Key: emailAttachments.s3Key,
          })
          .from(emailAttachments)
          .where(eq(emailAttachments.messageId, msg.id));

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
            downloadUrl: `/api/email/attachments/${a.id}`,
          })),
          receivedAt: msg.createdAt.toISOString(),
        };
      }),
    );

    return { messages: result, limit, offset };
  });

  app.post<{
    Params: { agentId: string };
    Body: unknown;
  }>("/agents/:agentId/email/send", async (request, reply) => {
    const { agentId } = request.params;

    const parsed = SendEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.issues,
      });
    }

    const agent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      return reply.status(404).send({ error: "Agent not found" });
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
