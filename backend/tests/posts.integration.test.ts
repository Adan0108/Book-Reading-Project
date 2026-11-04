import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { configureQaEnvironment } from "./qa-environment";
describe.skipIf(process.env.PUBLISHING_TEST_DATABASE !== "publishing_qa")(
  "real MySQL post artwork and retry integrity",
  () => {
    let pool: Pool,
      posts: typeof import("../src/services/post.service"),
      publishing: typeof import("../src/services/publishing.service");
    let owner: number,
      author: number,
      foreign: number,
      reader: number,
      postId: number;
    let first: string, second: string;
    async function user() {
      const [r] = await pool.query<ResultSetHeader>(
        "INSERT INTO users(email,password_hash,state) VALUES (?,'fixture-only',1)",
        [`post-${randomUUID()}@example.invalid`],
      );
      return r.insertId;
    }
    async function asset(
      purpose = "post",
      authorId = author,
      confirmed = true,
    ) {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO publishing_assets(id,author_id,purpose,public_id,expected_bytes,expected_format,image_url,confirmed_at,expires_at) VALUES (?,?,?,?,68,'png',?,IF(?=1,NOW(),NULL),DATE_ADD(NOW(),INTERVAL 1 HOUR))",
        [
          id,
          authorId,
          purpose,
          `qa/${id}`,
          `https://example.invalid/${id}.png`,
          Number(confirmed),
        ],
      );
      return id;
    }
    beforeAll(async () => {
      configureQaEnvironment();
      ({ pool } = await import("../src/dbs/init.mysql"));
      await (await import("../src/dbs/migrate")).runMigrationsOnce();
      await (await import("../src/dbs/migrate")).runMigrationsOnce();
      posts = await import("../src/services/post.service");
      publishing = await import("../src/services/publishing.service");
      owner = await user();
      reader = await user();
      const other = await user();
      for (const uid of [owner, other]) {
        const [a] = await pool.query<ResultSetHeader>(
          "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Post writer',1)",
          [uid],
        );
        if (uid === owner) author = a.insertId;
        else foreign = a.insertId;
      }
      first = await asset();
      second = await asset();
    }, 30000);
    afterAll(async () => {
      if (pool) await pool.end();
    });
    it("validates author-scoped upload metadata and retains chapter book requirements", () => {
      expect(() =>
        publishing.validateFile({
          purpose: "post",
          mimeType: "image/png",
          size: 68,
        }),
      ).not.toThrow();
      expect(() =>
        publishing.validateFile({
          purpose: "post",
          bookId: 1,
          mimeType: "image/png",
          size: 68,
        }),
      ).toThrow("author scoped");
      expect(() =>
        publishing.validateFile({
          purpose: "chapter",
          mimeType: "image/png",
          size: 68,
        }),
      ).toThrow("Book is required");
    });
    it("serializes concurrent duplicate creation and rejects conflicting keys", async () => {
      const body = {
        title: "A spoiler update",
        body: "The hidden ending",
        isDraft: false,
        isSpoiler: true,
        imageAssetIds: [first, second],
        requestId: randomUUID(),
      };
      const [a, b] = await Promise.all([
        posts.savePost(owner, body),
        posts.savePost(owner, body),
      ]);
      expect(a.id).toBe(b.id);
      postId = a.id;
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM author_posts WHERE id=?",
        [postId],
      );
      expect(Number(rows[0].n)).toBe(1);
      await expect(
        posts.savePost(owner, { ...body, title: "changed" }),
      ).rejects.toThrow("different content");
      const my = (await posts.myPosts(owner)).items.find(
        (p) => p.id === postId,
      )!;
      expect(my.isSpoiler).toBe(true);
      expect(my.images.map((i) => i.id)).toEqual([first, second]);
    });
    it("preserves omitted media/spoiler fields and transactionally reorders/removes them", async () => {
      await posts.savePost(
        owner,
        { title: "An edited update", requestId: randomUUID() },
        postId,
      );
      let my = (await posts.myPosts(owner)).items.find((p) => p.id === postId)!;
      expect(my.isSpoiler).toBe(true);
      expect(my.images.map((i) => i.id)).toEqual([first, second]);
      await posts.savePost(
        owner,
        { imageAssetIds: [second, first], requestId: randomUUID() },
        postId,
      );
      my = (await posts.myPosts(owner)).items.find((p) => p.id === postId)!;
      expect(my.images.map((i) => i.id)).toEqual([second, first]);
      await posts.savePost(
        owner,
        { imageAssetIds: [second], requestId: randomUUID() },
        postId,
      );
      expect(
        (await posts.getPublicPost(author, postId)).images.map((i) => i.id),
      ).toEqual([second]);
    });
    it("rejects foreign/unconfirmed/wrong-purpose/attached assets without partial writes", async () => {
      for (const id of [
        await asset("post", foreign),
        await asset("post", author, false),
        await asset("cover"),
        second,
      ]) {
        await expect(
          posts.savePost(owner, {
            title: "Rejected",
            body: "text",
            imageAssetIds: [id],
            requestId: randomUUID(),
          }),
        ).rejects.toThrow(/authorized|attached/);
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM author_posts WHERE author_id=? AND title='Rejected'",
        [author],
      );
      expect(rows).toHaveLength(0);
      expect((await posts.getPublicPost(author, postId)).title).toBe(
        "An edited update",
      );
    });
    it("rejects excessive and duplicate references and cross-author mutations", async () => {
      await expect(
        posts.savePost(owner, {
          title: "Too many",
          imageAssetIds: Array.from({ length: 9 }, () => randomUUID()),
        }),
      ).rejects.toThrow("eight");
      await expect(
        posts.savePost(owner, {
          title: "Duplicate",
          imageAssetIds: [first, first],
        }),
      ).rejects.toThrow("distinct");
      await expect(
        posts.savePost(reader, { title: "No author" }),
      ).rejects.toThrow("approved author");
      await expect(
        posts.savePost(owner, { title: "edit" }, Number.MAX_SAFE_INTEGER),
      ).rejects.toThrow("unavailable");
    });
    it("omits protected body and image URLs from teasers, then enforces current membership", async () => {
      await posts.savePost(
        owner,
        { visibility: "MEMBERS", requestId: randomUUID() },
        postId,
      );
      const locked = (await posts.listPublicPosts(author, reader)).items.find(
        (p) => p.id === postId,
      )!;
      expect(locked.isSpoiler).toBe(true);
      expect(locked.isLocked).toBe(true);
      expect(locked).not.toHaveProperty("body");
      expect(locked).not.toHaveProperty("images");
      await expect(
        posts.getPublicPost(author, postId, reader),
      ).rejects.toThrow();
      const [tier] = await pool.query<ResultSetHeader>(
        "INSERT INTO membership_tiers(author_id,name,price,currency,is_active) VALUES (?,'Post QA',5,'USD',1)",
        [author],
      );
      await pool.query(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,started_at,current_period_end,auto_renew,provider) VALUES (?,?,?,'ACTIVE',DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),0,'MANUAL')",
        [reader, author, tier.insertId],
      );
      const allowed = (await posts.listPublicPosts(author, reader)).items.find(
        (p) => p.id === postId,
      )!;
      expect(allowed.body).toBe("The hidden ending");
      expect(allowed.images?.map((i) => i.id)).toEqual([second]);
      await pool.query(
        "UPDATE memberships SET current_period_end=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE user_id=? AND author_id=?",
        [reader, author],
      );
      expect(
        (await posts.listPublicPosts(author, reader)).items.find(
          (p) => p.id === postId,
        ),
      ).not.toHaveProperty("images");
    });
    it("paginates older owned posts without losing artwork or crossing author scope", async () => {
      for (let i = 0; i < 52; i++)
        await posts.savePost(owner, {
          title: `Older post ${i}`,
          isDraft: true,
        });
      const firstPage = await posts.myPosts(owner),
        next = await posts.myPosts(owner, firstPage.nextCursor);
      expect(firstPage.items).toHaveLength(50);
      expect(firstPage.nextCursor).not.toBeNull();
      expect(next.items.some((p) => p.id === postId)).toBe(true);
      expect(
        new Set([...firstPage.items, ...next.items].map((p) => p.id)).size,
      ).toBe(firstPage.items.length + next.items.length);
      expect(
        next.items.find((p) => p.id === postId)?.images.map((i) => i.id),
      ).toEqual([second]);
      await expect(posts.myPosts(owner, "invalid")).rejects.toMatchObject({
        status: 400,
      });
    });
    it("allows draft-only empty text but requires text for published updates", async () => {
      const saved = await posts.savePost(owner, {
        title: "Empty draft",
        isDraft: true,
      });
      expect(saved.isDraft).toBe(true);
      await expect(
        posts.savePost(
          owner,
          { isDraft: false, imageAssetIds: [first] },
          saved.id,
        ),
      ).rejects.toThrow("post text");
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT is_draft FROM author_posts WHERE id=?",
        [saved.id],
      );
      expect(rows[0].is_draft).toBe(1);
    });
  },
);
