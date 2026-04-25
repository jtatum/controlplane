import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import * as jose from "jose";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { users, agents } from "@controlplane/shared";
import { db } from "./db.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    dbUser: typeof users.$inferSelect | null;
    authenticatedAgentId: string;
  }
}

const DEV_USER = {
  externalId: "dev-user-001",
  email: "dev@openclaw.local",
  displayName: "Dev User",
};

async function ensureDevUser() {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, DEV_USER.externalId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      externalId: DEV_USER.externalId,
      email: DEV_USER.email,
      displayName: DEV_USER.displayName,
      role: "admin",
    })
    .returning();

  return created;
}

async function oidcAuth(app: FastifyInstance) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEV_MODE === "true"
  ) {
    throw new Error(
      "FATAL: DEV_MODE=true is not allowed when NODE_ENV=production",
    );
  }

  const devMode = process.env.DEV_MODE === "true";

  app.decorateRequest("userId", "");
  app.decorateRequest("userEmail", "");
  app.decorateRequest("dbUser", null);
  app.decorateRequest("authenticatedAgentId", "");

  if (devMode) {
    app.log.warn("DEV_MODE enabled — authentication is bypassed");

    let devUser: typeof users.$inferSelect | null = null;

    app.addHook(
      "onRequest",
      async (request: FastifyRequest, _reply: FastifyReply) => {
        if (request.url === "/health") return;

        const header = request.headers.authorization;
        if (header?.startsWith("Bearer ")) {
          const token = header.slice(7);
          const tokenHash = createHash("sha256").update(token).digest("hex");
          const [agent] = await db
            .select({ id: agents.id })
            .from(agents)
            .where(eq(agents.agentTokenHash, tokenHash))
            .limit(1);

          if (agent) {
            request.authenticatedAgentId = agent.id;
            return;
          }
        }

        request.userId = DEV_USER.externalId;
        request.userEmail = DEV_USER.email;
      },
    );

    app.addHook(
      "preHandler",
      async (request: FastifyRequest, _reply: FastifyReply) => {
        if (request.url === "/health") return;
        if (request.authenticatedAgentId) return;

        if (!devUser) {
          devUser = await ensureDevUser();
        }
        request.dbUser = devUser;
      },
    );

    return;
  }

  const issuer = process.env.OIDC_ISSUER;
  if (!issuer) {
    throw new Error("OIDC_ISSUER environment variable is required");
  }

  const audience = process.env.OIDC_CLIENT_ID;
  if (!audience) {
    throw new Error("OIDC_CLIENT_ID environment variable is required");
  }

  let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  function getJWKS() {
    if (!jwks) {
      jwks = jose.createRemoteJWKSet(
        new URL(`${issuer}/.well-known/jwks.json`),
      );
    }
    return jwks;
  }

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url === "/health") return;

      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        reply
          .code(401)
          .send({ error: "Missing or invalid authorization header" });
        return;
      }

      const token = header.slice(7);
      try {
        const { payload } = await jose.jwtVerify(token, getJWKS(), {
          issuer,
          audience,
        });

        request.userId = payload.sub as string;
        request.userEmail = (payload.email as string) ?? "";
      } catch {
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const [agent] = await db
          .select({ id: agents.id })
          .from(agents)
          .where(eq(agents.agentTokenHash, tokenHash))
          .limit(1);

        if (!agent) {
          reply.code(401).send({ error: "Invalid token" });
          return;
        }

        request.authenticatedAgentId = agent.id;
      }
    },
  );
  app.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url === "/health") return;
      if (request.authenticatedAgentId) return;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.externalId, request.userId))
        .limit(1);

      if (!user) {
        reply.code(403).send({ error: "User not registered" });
        return;
      }

      request.dbUser = user;
    },
  );
}

export default fp(oidcAuth, { name: "oidc-auth" });
