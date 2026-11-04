import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import express from "express";
import request from "supertest";
import { configureQaEnvironment } from "./qa-environment";
const enabled = process.env.PUBLISHING_TEST_DATABASE === "publishing_qa";
describe.skipIf(!enabled)(
  "real MySQL discovery, profiles and private library",
  () => {
    let pool: Pool,
      redis: typeof import("../src/dbs/init.redis"),
      reader: typeof import("../src/services/reader.service"),
      publishing: typeof import("../src/services/publishing.service"),
      books: typeof import("../src/services/book.service"),
      sessions: typeof import("../src/services/session.service");
    let owner: number,
      authorId: number,
      viewer: number,
      other: number,
      bookId: number,
      chapterId: number,
      slug: string,
      tier: number,
      paidChapter: number;
    const stamp = randomUUID(),
      prefix = `Discovery ${stamp}`,
      genre = `Genre ${stamp}`,
      tag = `Tag ${stamp}`,
      app = express();
    async function user(role: string) {
      const [u] = await pool.query<ResultSetHeader>(
        "INSERT INTO users(email,password_hash,state) VALUES (?,'fixture-only',1)",
        [`library-${randomUUID()}@example.invalid`],
      );
      await pool.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code=?",
        [u.insertId, role],
      );
      return u.insertId;
    }
    beforeAll(async () => {
      configureQaEnvironment();
      ({ pool } = await import("../src/dbs/init.mysql"));
      await (await import("../src/dbs/migrate")).runMigrationsOnce();
      await (await import("../src/dbs/migrate")).runMigrationsOnce();
      redis = await import("../src/dbs/init.redis");
      await redis.initRedis();
      reader = await import("../src/services/reader.service");
      publishing = await import("../src/services/publishing.service");
      books = await import("../src/services/book.service");
      sessions = await import("../src/services/session.service");
      owner = await user("AUTHOR");
      viewer = await user("READER");
      other = await user("READER");
      const [a] = await pool.query<ResultSetHeader>(
        "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Library author',1)",
        [owner],
      );
      authorId = a.insertId;
      const book = await publishing.savePublication(
        owner,
        {
          requestId: randomUUID(),
          title: `${prefix} first`,
          genre,
          tags: [tag],
          status: "PUBLISHED",
        },
        "book",
      );
      bookId = book.id;
      slug = book.slug;
      await publishing.savePublication(
        owner,
        {
          requestId: randomUUID(),
          title: `${prefix} second`,
          genre,
          tags: [tag],
          status: "PUBLISHED",
        },
        "book",
      );
      await publishing.savePublication(
        owner,
        {
          requestId: randomUUID(),
          title: `${prefix} draft`,
          genre,
          tags: [tag],
          status: "DRAFT",
        },
        "book",
      );
      chapterId = (
        await publishing.savePublication(
          owner,
          {
            requestId: randomUUID(),
            title: "Library chapter",
            contentMd: "An actual readable chapter.",
            isDraft: false,
          },
          "chapter",
          bookId,
        )
      ).chapterId;
      tier = (
        await (
          await import("../src/services/membership.service")
        ).saveTier(owner, 1, { name: "Library supporters", benefits: [] })
      ).tier!.id;
      paidChapter = (
        await publishing.savePublication(
          owner,
          {
            requestId: randomUUID(),
            title: "Paid library chapter",
            contentMd: "Protected reading.",
            isDraft: false,
            visibility: "TIERS",
            requiredTierIds: [tier],
          },
          "chapter",
          bookId,
        )
      ).chapterId;
      app.use(express.json());
      app.use((await import("../src/routes")).default);
      app.use(
        (
          e: { status?: number; message: string },
          _q: express.Request,
          r: express.Response,
          _n: express.NextFunction,
        ) => r.status(e.status ?? 500).json({ message: e.message }),
      );
    }, 30000);
    afterAll(async () => {
      await pool?.end();
      await redis?.closeRedis();
    });
    it("returns real filters and stable title/author/genre/tag results without drafts", async () => {
      const filters = await reader.discoveryFilters();
      expect(filters.genres).toContain(genre);
      const first = await books.listBooksPublic({
        query: prefix,
        genre,
        page: 1,
        limit: 1,
      });
      expect(first.total).toBe(2);
      expect(first.items).toHaveLength(1);
      const second = await books.listBooksPublic({
        query: prefix,
        genre,
        page: 2,
        limit: 1,
      });
      expect(second.items[0].id).not.toBe(first.items[0].id);
      const [tags] = await pool.query<RowDataPacket[]>(
        "SELECT slug FROM tags WHERE name=?",
        [tag],
      );
      expect(
        (await books.listBooksPublic({ query: prefix, tag: tags[0].slug }))
          .total,
      ).toBe(2);
      expect(
        (await books.listBooksPublic({ query: "Library author", genre })).total,
      ).toBe(2);
      for (const query of [
        { page: "NaN" },
        { page: 0 },
        { limit: 1000 },
        { limit: "2.5" },
        { sort: "invented" },
        { query: ["array"] },
      ])
        await expect(books.listBooksPublic(query)).rejects.toMatchObject({
          status: 400,
        });
    });
    it("has an independent public author profile and never exposes a private account biography", async () => {
      const username = `Owner_${Date.now()}`;
      await reader.saveAccountProfile(owner, {
        username,
        bio: "Private account note",
        isPrivate: true,
      });
      expect((await reader.publicAuthor(authorId)).bio).toBe("");
      await reader.saveAuthorProfile(owner, {
        penName: `Library writer ${stamp}`,
        bio: "Public author biography",
      });
      const profile = await reader.publicAuthor(authorId);
      expect(profile.bio).toBe("Public author biography");
      expect(JSON.stringify(profile)).not.toContain("Private account note");
      expect(JSON.stringify(profile)).not.toMatch(/email|password|user_id/);
      const zeroUser = await user("AUTHOR"),
        [a] = await pool.query<ResultSetHeader>(
          "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'No books yet',1)",
          [zeroUser],
        );
      expect((await reader.publicAuthor(a.insertId)).bookCount).toBe(0);
    });
    it("rejects username collisions without updating another users profile, including first-time creation", async () => {
      const before = await reader.accountProfile(owner);
      await expect(
        reader.saveAccountProfile(viewer, {
          username: before.username,
          nickname: "Attempted overwrite",
          bio: "Wrong account",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect((await reader.accountProfile(owner)).bio).toBe(
        "Private account note",
      );
      await reader.saveAccountProfile(viewer, {
        username: `Viewer_${Date.now()}`,
        nickname: "Reader display",
        bio: "Own account",
        isPrivate: true,
      });
      await expect(
        reader.saveAccountProfile(viewer, {
          username: before.username,
          bio: "Second collision",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect((await reader.accountProfile(viewer)).bio).toBe("Own account");
      expect((await reader.accountProfile(owner)).bio).toBe(
        "Private account note",
      );
    });
    it("preserves omitted profile fields and privacy in partial updates", async () => {
      const old = await reader.accountProfile(viewer);
      await reader.saveAccountProfile(viewer, {
        nickname: "Changed display name",
      });
      const current = await reader.accountProfile(viewer);
      expect(current).toMatchObject({
        username: old.username,
        bio: old.bio,
        isPrivate: true,
        nickname: "Changed display name",
      });
      const author = await reader.authorProfile(owner);
      await reader.saveAuthorProfile(owner, {
        bio: "Updated public author biography",
      });
      expect((await reader.authorProfile(owner)).penName).toBe(author.penName);
    });
    it("follows and bookmarks idempotently with caller-scoped mutations and real follower counts", async () => {
      await Promise.all([
        reader.setFollowing(viewer, authorId, { followed: true }),
        reader.setFollowing(viewer, authorId, { followed: true }),
      ]);
      expect((await reader.follows(viewer)).items).toHaveLength(1);
      expect((await reader.follows(other)).items).toHaveLength(0);
      expect((await reader.publicAuthor(authorId, viewer)).isFollowing).toBe(
        true,
      );
      expect((await reader.publicAuthor(authorId)).followerCount).toBe(1);
      await expect(
        reader.setFollowing(owner, authorId, { followed: true }),
      ).rejects.toMatchObject({ status: 400 });
      await Promise.all([
        reader.setBookmark(viewer, bookId, { bookmarked: true }),
        reader.setBookmark(viewer, bookId, { bookmarked: true }),
      ]);
      expect((await reader.bookmarks(viewer)).items).toHaveLength(1);
      await reader.setBookmark(other, bookId, { bookmarked: false });
      expect((await reader.bookLibraryState(viewer, bookId)).bookmarked).toBe(
        true,
      );
      expect((await reader.bookmarks(other)).items).toHaveLength(0);
    });
    it("records only readable chapters and enforces membership and input constraints without adding book views", async () => {
      const [before] = await pool.query<RowDataPacket[]>(
        "SELECT views_count FROM books WHERE id=?",
        [bookId],
      );
      await reader.recordReading(viewer, { chapterId, progress: 42 });
      expect(
        (await reader.bookLibraryState(viewer, bookId)).lastRead?.progress,
      ).toBe(42);
      const [after] = await pool.query<RowDataPacket[]>(
        "SELECT views_count FROM books WHERE id=?",
        [bookId],
      );
      expect(after[0].views_count).toBe(before[0].views_count);
      await expect(
        reader.recordReading(viewer, { chapterId: paidChapter, progress: 1 }),
      ).rejects.toMatchObject({ status: 403 });
      await pool.query(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,current_period_end,provider) VALUES (?,?,?,'ACTIVE',DATE_ADD(NOW(),INTERVAL 1 DAY),'MANUAL')",
        [viewer, authorId, tier],
      );
      await reader.recordReading(viewer, {
        chapterId: paidChapter,
        progress: 11,
      });
      await expect(
        reader.recordReading(other, { chapterId, progress: 101 }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        reader.recordReading(other, { chapterId: 99999999, progress: 1 }),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("paginates equal-time history with stable ID ties, moves revisits first and keeps history private", async () => {
      for (let i = 0; i < 51; i++) {
        const [c] = await pool.query<ResultSetHeader>(
          "INSERT INTO chapters(book_id,author_id,title,slug,chapter_no,content_md,is_draft,published_at) VALUES (?,?,?, ?,?,'Pagination text',0,NOW())",
          [bookId, authorId, `History ${i}`, randomUUID(), 100 + i],
        );
        await pool.query(
          "INSERT INTO reading_history(user_id,chapter_id,progress_pct,last_read_at) VALUES (?,?,5,'2026-01-01 00:00:00.123456')",
          [viewer, c.insertId],
        );
      }
      const first = await reader.readingHistory(viewer);
      expect(first.items).toHaveLength(50);
      expect(first.nextCursor).toBeTruthy();
      const second = await reader.readingHistory(viewer, first.nextCursor);
      expect(second.items.length).toBeGreaterThan(0);
      expect(
        first.items.some((a) => second.items.some((b) => b.id === a.id)),
      ).toBe(false);
      expect((await reader.readingHistory(other)).items).toHaveLength(0);
      await reader.recordReading(viewer, { chapterId, progress: 77 });
      expect((await reader.readingHistory(viewer)).items[0].chapterId).toBe(
        chapterId,
      );
      await reader.removeHistory(other, chapterId);
      expect((await reader.readingHistory(viewer)).items[0].chapterId).toBe(
        chapterId,
      );
      await expect(
        reader.readingHistory(viewer, "invalid"),
      ).rejects.toMatchObject({ status: 400 });
    });
    it("redacts hidden library entries and allows their owner to remove them", async () => {
      const moderation = await import("../src/services/moderation.service"),
        admin = await user("ADMIN");
      await moderation.setContentHidden(admin, "BOOK", bookId, {
        hidden: true,
        version: 0,
        reason: "Library redaction QA",
      });
      const entry = (await reader.bookmarks(viewer)).items[0];
      expect(entry).toMatchObject({
        title: "Unavailable story",
        slug: null,
        coverUrl: null,
        available: false,
      });
      expect(
        (await reader.readingHistory(viewer)).items.find(
          (h) => h.chapterId === chapterId,
        ),
      ).toMatchObject({
        title: "Unavailable story",
        chapterNo: null,
        slug: null,
        available: false,
      });
      await expect(
        reader.recordReading(viewer, { chapterId, progress: 20 }),
      ).rejects.toMatchObject({ status: 404 });
      await reader.setBookmark(viewer, bookId, { bookmarked: false });
      expect((await reader.bookmarks(viewer)).items).toHaveLength(0);
      await moderation.setContentHidden(admin, "BOOK", bookId, {
        hidden: false,
        version: 1,
        reason: "Library QA restore",
      });
    });
    it("uses real JWT guards for library/profile writes and prevents foreign identity injection", async () => {
      expect((await request(app).get("/v1/api/library/history")).status).toBe(
        401,
      );
      const pair = await sessions.issueSession(viewer),
        headers = {
          "x-client-id": String(viewer),
          Authorization: `Bearer ${pair.accessToken}`,
        };
      expect(
        (await request(app).get("/v1/api/authors/me/profile").set(headers))
          .status,
      ).toBe(403);
      const response = await request(app)
        .patch("/v1/api/user/me/profile")
        .set(headers)
        .send({
          userId: other,
          username: `Scoped_${Date.now()}`,
          bio: "Caller-owned biography",
          isPrivate: true,
        });
      expect(response.status).toBe(200);
      expect(response.body.metadata.id).toBe(viewer);
      expect((await reader.accountProfile(other)).bio).toBe("");
      expect(
        (await request(app).get(`/v1/api/authors/${authorId}/profile`)).status,
      ).toBe(200);
    });
    it("returns actual owned-author analytics and redacts unavailable followed authors", async () => {
      const stats = await reader.authorAnalytics(owner);
      expect(stats.books).toBe(3);
      expect(stats.followers).toBe(1);
      expect(stats.eligibleMemberships).toBe(1);
      await pool.query("UPDATE users SET state=0 WHERE id=?", [owner]);
      await expect(reader.publicAuthor(authorId)).rejects.toMatchObject({
        status: 404,
      });
      expect((await reader.follows(viewer)).items[0]).toMatchObject({
        available: false,
        penName: "Unavailable author",
      });
      await reader.setFollowing(viewer, authorId, { followed: false });
      expect((await reader.follows(viewer)).items).toHaveLength(0);
      await pool.query("UPDATE users SET state=1 WHERE id=?", [owner]);
    });
  },
);
