import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import express from "express";
import request from "supertest";
import { configureQaEnvironment } from "./qa-environment";
const enabled = process.env.PUBLISHING_TEST_DATABASE === "publishing_qa";
describe.skipIf(!enabled)("real MySQL administration and moderation", () => {
  let pool: Pool,
    redis: typeof import("../src/dbs/init.redis"),
    moderation: typeof import("../src/services/moderation.service"),
    books: typeof import("../src/services/book.service"),
    publishing: typeof import("../src/services/publishing.service"),
    posts: typeof import("../src/services/post.service"),
    sessions: typeof import("../src/services/session.service");
  let owner: number,
    authorId: number,
    reader: number,
    admin: number,
    otherAdmin: number,
    bookId: number,
    chapterId: number,
    chapterNo: number,
    postId: number,
    slug: string,
    reportId: number;
  let originalPolicy: {
    reportsEnabled: boolean;
    reportsPerDay: number;
    version: number;
  };
  const app = express();
  async function user(role: string) {
    const [u] = await pool.query<ResultSetHeader>(
      "INSERT INTO users(email,password_hash,state) VALUES (?,'fixture-only',1)",
      [`moderation-${randomUUID()}@example.invalid`],
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
    moderation = await import("../src/services/moderation.service");
    books = await import("../src/services/book.service");
    publishing = await import("../src/services/publishing.service");
    posts = await import("../src/services/post.service");
    sessions = await import("../src/services/session.service");
    owner = await user("AUTHOR");
    reader = await user("READER");
    admin = await user("ADMIN");
    otherAdmin = await user("ADMIN");
    const [a] = await pool.query<ResultSetHeader>(
      "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Moderation author',1)",
      [owner],
    );
    authorId = a.insertId;
    const book = await publishing.savePublication(
      owner,
      {
        requestId: randomUUID(),
        title: `Moderation novel ${randomUUID()}`,
        genre: "Fantasy",
        status: "PUBLISHED",
      },
      "book",
    );
    bookId = book.id;
    slug = book.slug;
    const chapter = await publishing.savePublication(
      owner,
      {
        requestId: randomUUID(),
        title: "Moderation chapter",
        contentMd: "Safe published text.",
        isDraft: false,
      },
      "chapter",
      bookId,
    );
    chapterId = chapter.chapterId;
    chapterNo = chapter.chapterNo;
    postId = Number(
      (
        await posts.savePost(owner, {
          title: "Moderation update",
          body: "Published post body.",
          isDraft: false,
        })
      ).id,
    );
    originalPolicy = await moderation.moderationPolicy();
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
    if (originalPolicy) {
      const current = await moderation.moderationPolicy();
      await moderation.saveModerationPolicy(admin, {
        ...originalPolicy,
        version: current.version,
        reason: "Restore QA policy after verification",
      });
    }
    await pool?.end();
    await redis?.closeRedis();
  });
  it("keeps every admin route behind real token/role checks and omits account credential material", async () => {
    expect((await request(app).get("/v1/api/admin/dashboard")).status).toBe(
      401,
    );
    const pair = await sessions.issueSession(reader),
      headers = {
        "x-client-id": String(reader),
        Authorization: `Bearer ${pair.accessToken}`,
      };
    for (const path of [
      "dashboard",
      "users",
      "content",
      "reports",
      "moderation-policy",
      "audit",
    ])
      expect(
        (await request(app).get(`/v1/api/admin/${path}`).set(headers)).status,
      ).toBe(403);
    const adminPair = await sessions.issueSession(admin),
      adminHeaders = {
        "x-client-id": String(admin),
        Authorization: `Bearer ${adminPair.accessToken}`,
      };
    const users = await request(app)
      .get("/v1/api/admin/users")
      .set(adminHeaders);
    expect(users.status).toBe(200);
    expect(JSON.stringify(users.body)).not.toMatch(
      /password_hash|private_key|accessToken|refreshToken/,
    );
    expect(
      (await request(app).get("/v1/api/admin/dashboard").set(adminHeaders))
        .status,
    ).toBe(200);
  });
  it("hides warmed book/chapter content and prevents an author from clearing moderation by republishing", async () => {
    expect((await books.getBookDetailBySlug(slug)).id).toBe(bookId);
    expect((await books.getChapterContent(slug, chapterNo)).id).toBe(chapterId);
    await moderation.setContentHidden(admin, "BOOK", bookId, {
      hidden: true,
      version: 0,
      reason: "Review published story",
    });
    await expect(books.getBookDetailBySlug(slug)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      books.getChapterContent(slug, chapterNo),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await books.listBooksPublic({ query: slug })).items.some(
        (b) => b.id === bookId,
      ),
    ).toBe(false);
    expect(
      (await books.listBooksByAuthorPublic({ authorId })).items.some(
        (b) => b.id === bookId,
      ),
    ).toBe(false);
    await publishing.savePublication(
      owner,
      { requestId: randomUUID(), status: "PUBLISHED" },
      "book",
      bookId,
    );
    await expect(books.getBookDetailBySlug(slug)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (await books.authorGetBookDetail(owner, bookId)).moderationHidden,
    ).toBe(true);
    await expect(
      moderation.setContentHidden(admin, "BOOK", bookId, {
        hidden: false,
        version: 0,
        reason: "Stale decision",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await moderation.setContentHidden(admin, "BOOK", bookId, {
      hidden: false,
      version: 1,
      reason: "Review complete; restore",
    });
    expect((await books.getChapterContent(slug, chapterNo)).id).toBe(chapterId);
  });
  it("hides a chapter independently from its parent and excludes it from counts and TOC", async () => {
    await moderation.setContentHidden(admin, "CHAPTER", chapterId, {
      hidden: true,
      version: 0,
      reason: "Chapter review",
    });
    await expect(
      books.getChapterContent(slug, chapterNo),
    ).rejects.toMatchObject({ status: 404 });
    expect((await books.listChapterHeaders(slug)).items).toHaveLength(0);
    expect((await books.getBookDetailBySlug(slug)).totalChapters).toBe(0);
    expect(
      (await books.authorGetChapterDetail(owner, bookId, chapterId))
        .moderationHidden,
    ).toBe(true);
    await moderation.setContentHidden(admin, "CHAPTER", chapterId, {
      hidden: false,
      version: 1,
      reason: "Chapter restored",
    });
    expect((await books.listChapterHeaders(slug)).items).toHaveLength(1);
  });
  it("hides posts from both feed and direct reads without altering their text", async () => {
    await moderation.setContentHidden(admin, "POST", postId, {
      hidden: true,
      version: 0,
      reason: "Review announcement",
    });
    await expect(posts.getPublicPost(authorId, postId)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (await posts.myPosts(owner)).items.find((p) => p.id === postId)
        ?.moderationHidden,
    ).toBe(true);
    expect((await posts.listPublicPosts(authorId)).items).toHaveLength(0);
    expect((await moderation.contentDetail("POST", postId)).text).toBe(
      "Published post body.",
    );
    await moderation.setContentHidden(admin, "POST", postId, {
      hidden: false,
      version: 1,
      reason: "Announcement restored",
    });
    expect((await posts.getPublicPost(authorId, postId)).body).toBe(
      "Published post body.",
    );
  });
  it("accepts one open report per reader/content, records versioned reviews and audit reasons", async () => {
    const body = {
      kind: "BOOK",
      resourceId: bookId,
      reason: "Please review this title.",
    };
    const result = await Promise.all([
      moderation.createReport(reader, body),
      moderation.createReport(reader, body),
    ]);
    reportId = result[0].id;
    expect(result[1].id).toBe(reportId);
    await moderation.reviewReport(admin, reportId, {
      version: 1,
      status: "REVIEWING",
      reason: "Checking context",
    });
    await expect(
      moderation.reviewReport(admin, reportId, {
        version: 1,
        status: "DISMISSED",
        reason: "Stale review",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await moderation.reviewReport(admin, reportId, {
      version: 2,
      status: "RESOLVED",
      reason: "Reviewed and resolved",
    });
    await expect(
      moderation.reviewReport(admin, reportId, {
        version: 3,
        status: "REVIEWING",
        reason: "Cannot reopen closed",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const [audit] = await pool.query<RowDataPacket[]>(
      "SELECT details_json FROM admin_audit_logs WHERE target=? ORDER BY id DESC LIMIT 1",
      [`report:${reportId}`],
    );
    expect(JSON.stringify(audit[0].details_json)).toContain(
      "Reviewed and resolved",
    );
  });
  it("enforces report policy, rate limits and published-resource validation", async () => {
    const policy = await moderation.moderationPolicy();
    await moderation.saveModerationPolicy(admin, {
      ...policy,
      reportsEnabled: false,
      reason: "Disable QA reports temporarily",
    });
    await expect(
      moderation.createReport(reader, {
        kind: "POST",
        resourceId: postId,
        reason: "A report",
      }),
    ).rejects.toMatchObject({ status: 503 });
    const current = await moderation.moderationPolicy();
    await moderation.saveModerationPolicy(admin, {
      ...current,
      reportsEnabled: true,
      reportsPerDay: 1,
      reason: "Verify QA report quota",
    });
    await expect(
      moderation.createReport(reader, {
        kind: "POST",
        resourceId: postId,
        reason: "Over quota",
      }),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      moderation.saveModerationPolicy(admin, {
        ...policy,
        reason: "Stale policy",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      moderation.createReport(reader, {
        kind: "BOOK",
        resourceId: 999999999,
        reason: "Unknown content",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      moderation.setContentHidden(admin, "BOOK", bookId, {
        hidden: true,
        version: 2,
        reason: "",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const latest = await moderation.moderationPolicy();
    await moderation.saveModerationPolicy(admin, {
      ...originalPolicy,
      version: latest.version,
      reason: "Restore QA report defaults",
    });
  });
  it("suspends sessions and public author content, while restore never resurrects old sessions", async () => {
    const pair = await sessions.issueSession(owner);
    await moderation.setAccountState(admin, owner, {
      active: false,
      expectedState: 1,
      reason: "Account moderation QA",
    });
    await expect(
      sessions.verifySessionToken(pair.accessToken, owner, "access"),
    ).rejects.toMatchObject({ status: 401 });
    await expect(books.getBookDetailBySlug(slug)).rejects.toMatchObject({
      status: 404,
    });
    expect((await books.listBooksPublic({ query: slug })).items).toHaveLength(
      0,
    );
    await moderation.setAccountState(admin, owner, {
      active: true,
      expectedState: 0,
      reason: "Account restored after review",
    });
    await expect(
      sessions.verifySessionToken(pair.accessToken, owner, "access"),
    ).rejects.toMatchObject({ status: 401 });
    expect((await books.getBookDetailBySlug(slug)).id).toBe(bookId);
  });
  it("rejects self-suspension and pending activation, and serializes competing admin suspensions", async () => {
    await expect(
      moderation.setAccountState(admin, admin, {
        active: false,
        expectedState: 1,
        reason: "Unsafe self suspension",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const pending = await user("READER");
    await pool.query(
      "UPDATE users SET password_hash='---PENDING_SETUP---',state=0 WHERE id=?",
      [pending],
    );
    await expect(
      moderation.setAccountState(admin, pending, {
        active: true,
        expectedState: 0,
        reason: "Cannot bypass setup",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const a = await user("ADMIN"),
      b = await user("ADMIN");
    const results = await Promise.allSettled([
      moderation.setAccountState(a, b, {
        active: false,
        expectedState: 1,
        reason: "Concurrent administrator action A",
      }),
      moderation.setAccountState(b, a, {
        active: false,
        expectedState: 1,
        reason: "Concurrent administrator action B",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT state FROM users WHERE id IN (?,?)",
      [a, b],
    );
    expect(rows.filter((u) => u.state === 1)).toHaveLength(1);
  });
  it("restoring moderation never publishes a draft or makes it reportable", async () => {
    const draft = await publishing.savePublication(
      owner,
      {
        requestId: randomUUID(),
        title: `Draft moderation ${randomUUID()}`,
        genre: "Fantasy",
        status: "DRAFT",
      },
      "book",
    );
    await moderation.setContentHidden(admin, "BOOK", draft.id, {
      hidden: true,
      version: 0,
      reason: "Review draft visibility",
    });
    await moderation.setContentHidden(admin, "BOOK", draft.id, {
      hidden: false,
      version: 1,
      reason: "Draft remains a draft",
    });
    await expect(books.getBookDetailBySlug(draft.slug)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      moderation.createReport(reader, {
        kind: "BOOK",
        resourceId: draft.id,
        reason: "Draft is not public",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("reports actual aggregate counters and preserves the content payload through moderation", async () => {
    const stats = await moderation.dashboard();
    expect(stats.totalUsers).toBeGreaterThan(0);
    expect(stats.publishedBooks).toBeGreaterThan(0);
    expect(stats.sandboxDonationCents).toBeGreaterThanOrEqual(0);
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM users",
    );
    expect(stats.totalUsers).toBe(Number(rows[0].total));
    expect((await moderation.contentDetail("CHAPTER", chapterId)).text).toBe(
      "Safe published text.",
    );
  });
});
