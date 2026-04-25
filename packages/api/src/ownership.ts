import { eq } from "drizzle-orm";
import { agents } from "@controlplane/shared";
import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "./db.js";

export async function verifyAgentOwnership(
  agentId: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<typeof agents.$inferSelect | null> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    reply.code(404).send({ error: "Agent not found" });
    return null;
  }

  if (request.authenticatedAgentId) {
    if (request.authenticatedAgentId !== agentId) {
      reply.code(403).send({ error: "Forbidden" });
      return null;
    }
    return agent;
  }

  const user = request.dbUser!;
  if (user.role !== "admin" && agent.ownerId !== user.id) {
    reply.code(403).send({ error: "Forbidden" });
    return null;
  }

  return agent;
}

export function isAdmin(request: FastifyRequest): boolean {
  return request.dbUser?.role === "admin";
}
