import { FastifyInstance } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  agents,
  openclawVersions,
  CreateAgentSchema,
  AgentConfigSchema,
} from "@controlplane/shared";
import { db } from "../db.js";

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: AgentConfigSchema.optional(),
});

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const ListQuerySchema = z.object({
  status: z
    .enum([
      "requested",
      "provisioning",
      "running",
      "updating",
      "stopping",
      "stopped",
      "terminated",
      "error",
    ])
    .optional(),
  environment: z.enum(["dev", "prod"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function pickRegion(environment: string): string {
  return environment === "prod" ? "us-west-2" : "us-east-1";
}

export default async function agentRoutes(app: FastifyInstance) {
  app.post("/agents", async (request, reply) => {
    const body = CreateAgentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Validation failed", details: body.error.issues });
    }

    const { name, agentName, environment, instanceType, config } = body.data;
    const user = request.dbUser!;

    const defaultVersion = await db
      .select()
      .from(openclawVersions)
      .where(eq(openclawVersions.isDefault, true))
      .limit(1);

    const [agent] = await db
      .insert(agents)
      .values({
        ownerId: user.id,
        name,
        agentName,
        environment,
        instanceType,
        bedrockRegion: pickRegion(environment),
        versionId: defaultVersion[0]?.id ?? null,
        config: config ?? {},
      })
      .returning();

    return reply.code(201).send(formatDetail(agent, defaultVersion[0]?.version ?? null));
  });

  app.get("/agents", async (request, reply) => {
    const query = ListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Validation failed", details: query.error.issues });
    }

    const { status, environment, limit, offset } = query.data;
    const user = request.dbUser!;

    const conditions = [eq(agents.ownerId, user.id)];
    if (status) conditions.push(eq(agents.status, status));
    if (environment) conditions.push(eq(agents.environment, environment));

    const rows = await db
      .select({
        agent: agents,
        version: openclawVersions.version,
      })
      .from(agents)
      .leftJoin(openclawVersions, eq(agents.versionId, openclawVersions.id))
      .where(and(...conditions))
      .orderBy(agents.createdAt)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(and(...conditions));

    return reply.send({
      data: rows.map((r) => formatSummary(r.agent, r.version)),
      total: countResult.count,
      limit,
      offset,
    });
  });

  app.get("/agents/:id", async (request, reply) => {
    const params = ParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid agent ID" });
    }

    const user = request.dbUser!;

    const [row] = await db
      .select({
        agent: agents,
        version: openclawVersions.version,
      })
      .from(agents)
      .leftJoin(openclawVersions, eq(agents.versionId, openclawVersions.id))
      .where(and(eq(agents.id, params.data.id), eq(agents.ownerId, user.id)))
      .limit(1);

    if (!row) {
      return reply.code(404).send({ error: "Agent not found" });
    }

    return reply.send(formatDetail(row.agent, row.version));
  });

  app.patch("/agents/:id", async (request, reply) => {
    const params = ParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid agent ID" });
    }

    const body = UpdateAgentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Validation failed", details: body.error.issues });
    }

    if (Object.keys(body.data).length === 0) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    const user = request.dbUser!;

    const [existing] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, params.data.id), eq(agents.ownerId, user.id)))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Agent not found" });
    }

    if (existing.status === "terminated") {
      return reply.code(409).send({ error: "Cannot update a terminated agent" });
    }

    const updateFields: Partial<typeof agents.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.data.name !== undefined) updateFields.name = body.data.name;
    if (body.data.config !== undefined) updateFields.config = body.data.config;

    const [updated] = await db
      .update(agents)
      .set(updateFields)
      .where(eq(agents.id, params.data.id))
      .returning();

    const version = existing.versionId
      ? await db
          .select({ version: openclawVersions.version })
          .from(openclawVersions)
          .where(eq(openclawVersions.id, existing.versionId))
          .limit(1)
      : [];

    return reply.send(formatDetail(updated, version[0]?.version ?? null));
  });

  app.post("/agents/:id/terminate", async (request, reply) => {
    const params = ParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid agent ID" });
    }

    const user = request.dbUser!;

    const [existing] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, params.data.id), eq(agents.ownerId, user.id)))
      .limit(1);

    if (!existing) {
      return reply.code(404).send({ error: "Agent not found" });
    }

    if (existing.status === "terminated") {
      return reply.code(409).send({ error: "Agent is already terminated" });
    }

    if (existing.status === "stopping") {
      return reply.code(409).send({ error: "Agent is already stopping" });
    }

    const [updated] = await db
      .update(agents)
      .set({
        status: "stopping",
        updatedAt: new Date(),
      })
      .where(eq(agents.id, params.data.id))
      .returning();

    const version = existing.versionId
      ? await db
          .select({ version: openclawVersions.version })
          .from(openclawVersions)
          .where(eq(openclawVersions.id, existing.versionId))
          .limit(1)
      : [];

    return reply.send(formatDetail(updated, version[0]?.version ?? null));
  });
}

function formatSummary(
  agent: typeof agents.$inferSelect,
  version: string | null,
) {
  return {
    id: agent.id,
    name: agent.name,
    agentName: agent.agentName,
    environment: agent.environment,
    status: agent.status,
    version,
    bedrockRegion: agent.bedrockRegion,
    createdAt: agent.createdAt.toISOString(),
  };
}

function formatDetail(
  agent: typeof agents.$inferSelect,
  version: string | null,
) {
  return {
    ...formatSummary(agent, version),
    ownerId: agent.ownerId,
    ec2InstanceId: agent.ec2InstanceId,
    privateIp: agent.privateIp,
    availabilityZone: agent.availabilityZone,
    instanceType: agent.instanceType,
    config: agent.config,
    provisionedAt: agent.provisionedAt?.toISOString() ?? null,
    updatedAt: agent.updatedAt.toISOString(),
  };
}
