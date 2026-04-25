import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const TEST_DB = "controlplane_test";
const BASE_URL = "postgresql://controlplane:controlplane@localhost:5432";
const TEST_URL = `${BASE_URL}/${TEST_DB}`;

export async function setupTestDatabase() {
  const admin = new pg.Client(`${BASE_URL}/controlplane`);
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const migrationsDir = resolve(import.meta.dirname, "../../../../migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const test = new pg.Client(TEST_URL);
  await test.connect();
  for (const file of migrationFiles) {
    const migration = readFileSync(resolve(migrationsDir, file), "utf-8");
    const statements = migration.split("--> statement-breakpoint");
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) await test.query(trimmed);
    }
  }
  await test.end();

  return TEST_URL;
}

export async function teardownTestDatabase() {
  // No-op: setupTestDatabase() always drops the DB first, so leftover
  // state from a prior run is safe. Dropping here races with drizzle's
  // internal pool connections (which we can't close from test code)
  // and produces spurious FATAL errors in test output.
}

const TRUNCATE_TABLES = [
  "email_attachments",
  "email_messages",
  "agent_skills",
  "provisioning_jobs",
  "channel_email",
  "channel_telegram",
  "channels",
  "agents",
  "skills",
  "openclaw_versions",
  "audit_log",
];

export async function truncateAll(pool: pg.Pool) {
  await pool.query(`TRUNCATE ${TRUNCATE_TABLES.join(", ")} CASCADE`);
}
