import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import request from "supertest";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { configureQaEnvironment } from "./qa-environment";
describe.skipIf(process.env.PUBLISHING_TEST_DATABASE !== "publishing_qa")(
  "operational boundaries on isolated MySQL/Redis",
  () => {
    let pool: Pool,
      redis: typeof import("../src/dbs/init.redis"),
      migrations: typeof import("../src/dbs/migrate"),
      cache: typeof import("../src/utils/cache"),
      health: typeof import("../src/operations/readiness"),
      app: import("express").Express;
    beforeAll(async () => {
      configureQaEnvironment();
      ({ pool } = await import("../src/dbs/init.mysql"));
      migrations = await import("../src/dbs/migrate");
      await migrations.runMigrationsOnce();
      redis = await import("../src/dbs/init.redis");
      await redis.initRedis();
      cache = await import("../src/utils/cache");
      health = await import("../src/operations/readiness");
      app = (await import("../src/app")).createHttpApp();
    }, 30000);
    afterAll(async () => {
      await redis?.closeRedis();
      await pool?.end();
    });
    it("normalizes checkout line endings without overlooking actual SQL changes", () => {
      expect(migrations.migrationChecksum("SELECT 1;\r\n")).toBe(
        migrations.migrationChecksum("SELECT 1;\n"),
      );
      expect(migrations.migrationChecksum("SELECT 2;\n")).not.toBe(
        migrations.migrationChecksum("SELECT 1;\n"),
      );
    });
    it("serializes migration runners and verifies already applied checksums without writes", async () => {
      await Promise.all([
        migrations.runMigrationsOnce(),
        migrations.runMigrationsOnce(),
      ]);
      await expect(
        migrations.runMigrationsOnce({ apply: false }),
      ).resolves.toBeUndefined();
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT filename,COUNT(*) AS n FROM _migrations GROUP BY filename HAVING n>1",
      );
      expect(rows).toHaveLength(0);
    });
    it("refuses changed applied SQL and releases the migration lock on failure", async () => {
      const file = "20261105_0011_post_artwork.sql";
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT checksum FROM _migrations WHERE filename=?",
        [file],
      );
      try {
        await pool.query("UPDATE _migrations SET checksum=? WHERE filename=?", [
          "0".repeat(64),
          file,
        ]);
        await expect(migrations.runMigrationsOnce()).rejects.toThrow(
          "checksum changed",
        );
      } finally {
        await pool.query("UPDATE _migrations SET checksum=? WHERE filename=?", [
          rows[0].checksum,
          file,
        ]);
      }
      await expect(
        migrations.runMigrationsOnce({ apply: false }),
      ).resolves.toBeUndefined();
    });
    it("refuses a missing applied migration rather than silently starting", async () => {
      const file = `missing-${randomUUID()}.sql`;
      try {
        await pool.query(
          "INSERT INTO _migrations(filename,checksum) VALUES (?,?)",
          [file, "1".repeat(64)],
        );
        await expect(
          migrations.runMigrationsOnce({ apply: false }),
        ).rejects.toThrow("missing");
      } finally {
        await pool.query("DELETE FROM _migrations WHERE filename=?", [file]);
      }
    });
    it("reports liveness separately from schema and dependency readiness", async () => {
      expect((await request(app).get("/health/live")).status).toBe(200);
      expect((await request(app).get("/health/ready")).status).toBe(503);
      health.markSchemaReady();
      const ready = await request(app).get("/health/ready");
      expect(ready.status).toBe(200);
      expect(ready.body).toMatchObject({
        ready: true,
        database: true,
        redis: true,
        schema: true,
      });
    });
    it("falls back to SQL loaders and avoids inflated view claims while its Redis client is offline", async () => {
      await redis.closeRedis();
      try {
        expect(await cache.cacheGet("qa:missing")).toBeNull();
        expect(
          await cache.cacheAside("qa:missing", 60, async () => ({
            from: "database",
          })),
        ).toEqual({ from: "database" });
        await expect(
          cache.cacheSet("qa:missing", "ignored", 60),
        ).resolves.toBeUndefined();
        await expect(cache.cacheDel("qa:missing")).resolves.toBeUndefined();
        expect(await cache.cacheSetNx("qa:missing", "1", 60)).toBe(false);
        await expect(
          redis.securityRedis((c) => c.get("qa:missing")),
        ).rejects.toMatchObject({ status: 503 });
        expect((await request(app).get("/health/ready")).status).toBe(503);
        const publicList = await request(app).get("/v1/api/books?limit=1");
        expect(publicList.status).toBe(200);
        const login = await request(app)
          .post("/v1/api/access/login")
          .set("Origin", "http://localhost:8000")
          .send({
            email: "nobody@example.invalid",
            password: "Not-a-real-password!",
          });
        expect(login.status).toBe(503);
      } finally {
        await redis.initRedis();
      }
      expect((await request(app).get("/health/ready")).status).toBe(200);
    });
    it("does not regard a draining process as ready", async () => {
      health.markDraining();
      const draining = await request(app).get("/health/ready");
      expect(draining.status).toBe(503);
      expect(draining.body.draining).toBe(true);
      expect((await request(app).get("/health/live")).status).toBe(200);
    });
  },
);
