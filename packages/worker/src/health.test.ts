import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { type Server } from "node:http";

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), fatal: vi.fn() },
}));

let server: Server | undefined;

async function getHealthServer() {
  const { startHealthServer } = await import("./health.js");
  return startHealthServer();
}

async function fetch200(port: number, path: string) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: await res.json() };
}

async function fetchStatus(port: number, path: string, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { method });
  return res.status;
}

describe("health server", () => {
  beforeEach(() => {
    process.env.WORKER_HEALTH_PORT = "0";
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    delete process.env.WORKER_HEALTH_PORT;
  });

  it("responds 200 with { status: ok } on GET /health", async () => {
    server = await getHealthServer();
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const port = (server.address() as any).port;

    const { status, body } = await fetch200(port, "/health");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("responds 404 for unknown paths", async () => {
    server = await getHealthServer();
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const port = (server.address() as any).port;

    const status = await fetchStatus(port, "/unknown");
    expect(status).toBe(404);
  });

  it("responds 404 for non-GET methods on /health", async () => {
    server = await getHealthServer();
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const port = (server.address() as any).port;

    const status = await fetchStatus(port, "/health", "POST");
    expect(status).toBe(404);
  });
});
