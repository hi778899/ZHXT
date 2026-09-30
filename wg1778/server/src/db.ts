import pg from "pg"

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://cockpit:cockpit@localhost:5432/cockpit",
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
})

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values)
}

export async function closePool() {
  await pool.end()
}
