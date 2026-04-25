import { describe, it, expect, afterEach } from "vitest";

describe("vite config production guard", () => {
  const originalViteDevMode = process.env.VITE_DEV_MODE;

  afterEach(() => {
    if (originalViteDevMode === undefined) {
      delete process.env.VITE_DEV_MODE;
    } else {
      process.env.VITE_DEV_MODE = originalViteDevMode;
    }
  });

  it("throws when VITE_DEV_MODE=true in production mode", async () => {
    process.env.VITE_DEV_MODE = "true";
    const { default: configFn } = await import("./vite.config.js");
    expect(() =>
      configFn({ mode: "production", command: "build" } as any),
    ).toThrow("FATAL: VITE_DEV_MODE=true is not allowed in production builds");
  });

  it("allows VITE_DEV_MODE=true in development mode", async () => {
    process.env.VITE_DEV_MODE = "true";
    const { default: configFn } = await import("./vite.config.js");
    const config = configFn({ mode: "development", command: "serve" } as any);
    expect(config).toHaveProperty("plugins");
  });

  it("allows production mode without VITE_DEV_MODE", async () => {
    delete process.env.VITE_DEV_MODE;
    const { default: configFn } = await import("./vite.config.js");
    const config = configFn({ mode: "production", command: "build" } as any);
    expect(config).toHaveProperty("plugins");
  });
});
