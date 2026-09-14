import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { closePool, pool } from "./db.js"

async function migrate() {
  const dir = path.resolve(process.cwd(), "server/migrations")
  const files = (await readdir(dir)).filter(name => name.endsWith(".sql")).sort()
  const client = await pool.connect()
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())")
    for (const file of files) {
      const existing = await client.query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", [file])
      if (existing.rowCount) continue
      const sql = await readFile(path.join(dir, file), "utf8")
      await client.query("BEGIN")
      try {
        await client.query(sql)
        await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [file])
        await client.query("COMMIT")
        console.log(`Applied migration ${file}`)
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      }
    }
  } finally {
    client.release()
    await closePool()
  }
}

migrate().catch(error => { console.error(error); process.exitCode = 1 })
