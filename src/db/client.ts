/**
 * Drizzle client backed by node-postgres (`pg`). Works with both Neon
 * (connection string) and Cloud SQL via the Cloud SQL Auth Proxy running on
 * 127.0.0.1:6432. On Cloud Run we'd swap the `Pool` for the Unix-socket
 * `/cloudsql/<instance>` path; that's handled by DATABASE_URL shape.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

// Global-cached in dev to survive hot reloads, so we don't exhaust pg pool.
declare global {
  var __vibeathonPgPool: Pool | undefined;
}

const pool =
  globalThis.__vibeathonPgPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__vibeathonPgPool = pool;
}

export const db = drizzle(pool, { schema });
export { pool, schema };
