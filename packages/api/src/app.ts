import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import oidcAuth from "./auth.js";
import agentRoutes from "./routes/agents.js";
import { agentEmailRoutes } from "./routes/agent-email.js";
import { humanEmailRoutes } from "./routes/human-email.js";
import oidcAuth from "./auth.js";
import agentRoutes from "./routes/agents.js";

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(helmet);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(oidcAuth);
  await app.register(agentRoutes);
  await app.register(agentEmailRoutes, { prefix: "/api" });
  await app.register(humanEmailRoutes, { prefix: "/api" });
  await app.register(oidcAuth);
  await app.register(agentRoutes, { prefix: "/api" });

  return app;
}
