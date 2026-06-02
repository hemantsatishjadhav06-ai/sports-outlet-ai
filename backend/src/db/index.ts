import { Pool } from "pg";
import { config } from "../config.js";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (pool) return pool;
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL not set -- cannot create db pool");
  }
  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.nodeEnv === "production" ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
  pool.on("error", (err) => {
    console.error("[db] pool error", err);
  });
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
