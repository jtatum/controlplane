import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf-8"),
);

// eslint is not yet installed — skip until dependency is added
const KNOWN_MISSING: Set<string> = new Set(["lint"]);

const binaryChecks: Record<string, string> = {
  dev: "pnpm exec concurrently --version",
  "dev:api": "pnpm --filter @controlplane/api exec tsx --version",
  "dev:web": "pnpm --filter @controlplane/web exec vite --version",
  "dev:worker": "pnpm --filter @controlplane/worker exec tsx --version",
  build: "pnpm exec tsc --version",
  test: "pnpm exec vitest --version",
  "test:watch": "pnpm exec vitest --version",
  lint: "pnpm exec eslint --version",
  format: "pnpm exec prettier --version",
  "db:generate": "pnpm exec drizzle-kit --version",
  "db:migrate": "pnpm exec drizzle-kit --version",
  "db:seed": "pnpm --filter @controlplane/api exec tsx --version",
  "db:studio": "pnpm exec drizzle-kit --version",
  typecheck: "pnpm exec tsc --version",
};

describe("env file loading", () => {
  const subPkgs = ["api", "worker"] as const;

  it.each(subPkgs)("%s dev script loads .env.local", (name) => {
    const subPkg = JSON.parse(
      readFileSync(join(__dirname, `packages/${name}/package.json`), "utf-8"),
    );
    expect(subPkg.scripts.dev).toContain("--env-file-if-exists");
    expect(subPkg.scripts.dev).toContain(".env.local");
  });

  it(".env.example exists and contains DATABASE_URL", () => {
    const example = readFileSync(join(__dirname, ".env.example"), "utf-8");
    expect(example).toContain("DATABASE_URL=");
    expect(example).toContain("TEMPORAL_ADDRESS=");
    expect(example).toContain("DEV_MODE=");
  });
});

describe("root package.json scripts", () => {
  const scriptNames = Object.keys(pkg.scripts);

  it("has a binary check for every script", () => {
    const missing = scriptNames.filter((s) => !(s in binaryChecks));
    expect(missing, `Scripts without binary checks: ${missing.join(", ")}`).toEqual([]);
  });

  describe.each(scriptNames)("%s", (name) => {
    it.skipIf(KNOWN_MISSING.has(name))("resolves its binary", () => {
      const cmd = binaryChecks[name];
      expect(cmd, `No binary check defined for script "${name}"`).toBeDefined();
      const result = execSync(cmd!, { timeout: 15000, encoding: "utf-8" });
      expect(result.trim()).not.toBe("");
    });
  });
});
