import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@controlplane/shared";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

export const db = drizzle(
  databaseUrl ?? "postgresql://controlplane:controlplane@localhost:5432/controlplane",
  { schema },
);
export type Db = typeof db;
