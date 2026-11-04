import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./init.mysql";
export function migrationChecksum(sql: string) {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}
// MySQL DDL commits implicitly. The journal records a file only after every statement succeeds;
// a partial DDL failure needs operator review, not a misleading rollback promise.
export async function runMigrationsOnce({
  apply = true,
}: { apply?: boolean } = {}): Promise<void> {
  const db = await pool.getConnection();
  let locked = false;
  try {
    const [locks] = await db.query<RowDataPacket[]>(
      "SELECT GET_LOCK(SHA2(CONCAT('hibook:migrations:',DATABASE()),256),30) AS acquired",
    );
    if (Number(locks[0].acquired) !== 1)
      throw new Error("Could not acquire the database migration lock");
    locked = true;
    if (apply)
      await db.query(
        "CREATE TABLE IF NOT EXISTS _migrations (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,filename VARCHAR(255) NOT NULL UNIQUE,applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,checksum CHAR(64) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
      );
    const [columns] = await db.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='_migrations' AND COLUMN_NAME='checksum'",
    );
    if (!columns.length) {
      if (!apply)
        throw new Error("Migration journal requires an explicit migrate run");
      await db.query(
        "ALTER TABLE _migrations ADD COLUMN checksum CHAR(64) NULL",
      );
    }
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT filename,checksum FROM _migrations",
    );
    const directory = path.resolve(__dirname, "../migrations"),
      files = fs
        .readdirSync(directory)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    const sources = new Map(
      files.map((file) => [
        file,
        fs.readFileSync(path.join(directory, file), "utf8"),
      ]),
    );
    for (const row of rows) {
      const sql = sources.get(row.filename);
      if (sql === undefined)
        throw new Error(`Applied migration is missing: ${row.filename}`);
      if (row.checksum && row.checksum !== migrationChecksum(sql))
        throw new Error(`Applied migration checksum changed: ${row.filename}`);
    }
    const applied = new Map(rows.map((r) => [String(r.filename), r.checksum]));
    if (
      !apply &&
      (files.some((f) => !applied.has(f)) || rows.some((r) => !r.checksum))
    )
      throw new Error(
        "Database migrations pending. Back up and run npm run migrate before startup.",
      );
    for (const file of files) {
      const sql = sources.get(file)!,
        checksum = migrationChecksum(sql);
      if (applied.has(file)) {
        // Historical journals had no digest. This adopts the currently reviewed file, not retroactive proof.
        if (!applied.get(file) && apply)
          await db.query(
            "UPDATE _migrations SET checksum=? WHERE filename=? AND checksum IS NULL",
            [checksum, file],
          );
        continue;
      }
      console.log(`[migrate] Applying ${file}`);
      await db.query(sql);
      await db.query(
        "INSERT INTO _migrations(filename,checksum) VALUES (?,?)",
        [file, checksum],
      );
    }
    console.log("[migrate] Schema verified");
  } finally {
    try {
      if (locked)
        await db.query(
          "SELECT RELEASE_LOCK(SHA2(CONCAT('hibook:migrations:',DATABASE()),256))",
        );
    } finally {
      db.release();
    }
  }
}
if (require.main === module) {
  runMigrationsOnce()
    .catch((error) => {
      console.error(`[migrate] ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
