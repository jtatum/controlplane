import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn().mockReturnValue({}),
}));

describe("db module", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
  });

  it("throws when DATABASE_URL is missing in production", async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "production";

    await expect(() => import("./db.js")).rejects.toThrow(
      "DATABASE_URL is required in production",
    );
  });

  it("uses fallback when DATABASE_URL is missing in non-production", async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = "development";

    const mod = await import("./db.js");
    expect(mod.db).toBeDefined();
  });
});
