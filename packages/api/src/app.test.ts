import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./db.js", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn(() => ({ ...chain })),
      insert: vi.fn(() => ({ ...chain })),
    },
  };
});

vi.mock("./temporal.js", () => ({
  getTemporalClient: vi.fn(),
  TASK_QUEUE: "test-queue",
}));

import { createApp } from "./app.js";

describe("app smoke test", () => {
  const originalEnv = process.env.DEV_MODE;

  beforeEach(() => {
    process.env.DEV_MODE = "true";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DEV_MODE;
    } else {
      process.env.DEV_MODE = originalEnv;
    }
  });

  it("initializes without errors in dev mode", async () => {
    const app = await createApp();
    await app.ready();
    await app.close();
  });

  it("registers the health endpoint", async () => {
    const app = await createApp();
    await app.ready();

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("throws when DEV_MODE=true and NODE_ENV=production", async () => {
    process.env.DEV_MODE = "true";
    process.env.NODE_ENV = "production";

    await expect(createApp()).rejects.toThrow(
      "FATAL: DEV_MODE=true is not allowed when NODE_ENV=production",
    );

    delete process.env.NODE_ENV;
  });

  it("allows DEV_MODE=true when NODE_ENV is not production", async () => {
    process.env.DEV_MODE = "true";
    process.env.NODE_ENV = "development";

    const app = await createApp();
    await app.ready();
    await app.close();

    delete process.env.NODE_ENV;
  });
});
