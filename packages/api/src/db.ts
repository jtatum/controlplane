import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@controlplane/shared";

export const db = drizzle(
  process.env.DATABASE_URL ??
    "postgresql://controlplane:controlplane@localhost:5432/controlplane",
  { schema },
);
export type Db = typeof db;
