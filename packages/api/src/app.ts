import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";

export async function createApp() {
  const app = Fastify({ logger: true });

  await app.register(cors);
  await app.register(helmet);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
