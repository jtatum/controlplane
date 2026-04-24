import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import * as jose from "jose";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

async function oidcAuth(app: FastifyInstance) {
  const issuer = process.env.OIDC_ISSUER;
  if (!issuer) {
    throw new Error("OIDC_ISSUER environment variable is required");
  }

  const audience = process.env.OIDC_CLIENT_ID;
  let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

  function getJWKS() {
    if (!jwks) {
      jwks = jose.createRemoteJWKSet(
        new URL(`${issuer}/.well-known/jwks.json`),
      );
    }
    return jwks;
  }

  app.decorateRequest("userId", "");
  app.decorateRequest("userEmail", "");

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url === "/health") return;

      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        reply.code(401).send({ error: "Missing or invalid authorization header" });
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
        reply.code(401).send({ error: "Invalid token" });
      }
    },
  );
}

export default fp(oidcAuth, { name: "oidc-auth" });
