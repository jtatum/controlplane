import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLog, users } from "@controlplane/shared";
import { db } from "../db.js";

const QuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function auditLogRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: Record<string, string | undefined>;
  }>("/audit-log", async (request, reply) => {
    const query = QuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .code(400)
        .send({ error: "Validation failed", details: query.error.issues });
    }

    const { agentId, actorId, action, from, to, limit, offset } = query.data;
    const conditions = [];

    if (agentId) conditions.push(eq(auditLog.agentId, agentId));
    if (actorId) conditions.push(eq(auditLog.actorId, actorId));
    if (action) conditions.push(eq(auditLog.action, action));
    if (from) conditions.push(gte(auditLog.createdAt, from));
    if (to) conditions.push(lte(auditLog.createdAt, to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: auditLog.id,
          actorId: auditLog.actorId,
          actorType: auditLog.actorType,
          actorEmail: users.email,
          agentId: auditLog.agentId,
          action: auditLog.action,
          resourceType: auditLog.resourceType,
          resourceId: auditLog.resourceId,
          detail: auditLog.detail,
          ipAddress: auditLog.ipAddress,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.actorId, users.id))
        .where(where)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where),
    ]);

    return reply.send({
      data: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      total: countResult[0].count,
      limit,
      offset,
    });
  });
}
