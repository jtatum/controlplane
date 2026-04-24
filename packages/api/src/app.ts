import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { agentEmailRoutes } from "./routes/agent-email.js";
import { humanEmailRoutes } from "./routes/human-email.js";

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(helmet);

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(agentEmailRoutes, { prefix: "/api" });
  await app.register(humanEmailRoutes, { prefix: "/api" });

  return app;
}
