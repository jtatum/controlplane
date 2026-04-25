import { createServer, type Server } from "node:http";
import { logger } from "./logger.js";

const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT ?? "3001", 10);

export function startHealthServer(): Server {
  const server = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(HEALTH_PORT, () => {
    logger.info({ port: HEALTH_PORT }, "health server listening");
  });

  return server;
}
