import fs from "fs";
import path from "path";
import { pool } from "./init.mysql";

/**
 * Automatically applies new SQL migration files once.
 * Each file is recorded in the `_migrations` table.
 */
export async function runMigrationsOnce(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    // Ensure _migrations table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Get list of already applied migrations
    const [rows] = await conn.query("SELECT filename FROM _migrations");
    const applied = new Set((rows as any[]).map(r => r.filename));

    // Find all migration SQL files
    const dir = path.resolve(process.cwd(), "src/migrations");
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue; // skip already applied

      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`[migrate] Applying ${file}...`);

      try {
        await conn.beginTransaction();
        await conn.query(sql);
        await conn.query("INSERT INTO _migrations (filename) VALUES (?)", [file]);
        await conn.commit();
        console.log(`[migrate] ✅ Applied ${file}`);
      } catch (err) {
        await conn.rollback();
        console.error(`[migrate] ❌ Failed ${file}`, err);
        throw err;
      }
    }

    console.log("[migrate] ✅ All migrations up to date.");
  } finally {
    conn.release();
  }
}
