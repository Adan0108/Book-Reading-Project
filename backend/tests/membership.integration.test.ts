import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { configureQaEnvironment } from "./qa-environment";

const enabled = process.env.PUBLISHING_TEST_DATABASE === "publishing_qa";
describe.skipIf(!enabled)(
  "real MySQL author memberships and shared access",
  () => {
    let pool: typeof import("../src/dbs/init.mysql").pool;
    let redis: typeof import("../src/dbs/init.redis");
    let memberships: typeof import("../src/services/membership.service");
    let access: typeof import("../src/services/entitlement.service");
    let publishing: typeof import("../src/services/publishing.service");
    let books: typeof import("../src/services/book.service");
    let posts: typeof import("../src/services/post.service");
    let sessions: typeof import("../src/services/session.service");
    let authorUser: number,
      authorId: number,
      otherUser: number,
      otherAuthor: number,
      reader: number,
      admin: number,
      tierOne: number,
      tierTwo: number,
      foreignTier: number,
      memberId: number,
      bookId: number,
      chapterId: number,
      chapterNo: number,
      slug: string,
      postId: number;
    let originalPolicy: import("../src/services/membership.service").MembershipPolicy;
    const app = express();
    async function user(role: string) {
      const [result]: any = await pool.query(
        "INSERT INTO users(email,password_hash,state) VALUES (?,'fixture-only',1)",
        [`member-${randomUUID()}@example.invalid`],
      );
      await pool.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code=?",
        [result.insertId, role],
      );
      return Number(result.insertId);
    }
    beforeAll(async () => {
      configureQaEnvironment();
      ({ pool } = await import("../src/dbs/init.mysql"));
      const { runMigrationsOnce } = await import("../src/dbs/migrate");
      await runMigrationsOnce();
      await runMigrationsOnce();
      redis = await import("../src/dbs/init.redis");
      await redis.initRedis();
      memberships = await import("../src/services/membership.service");
      access = await import("../src/services/entitlement.service");
      publishing = await import("../src/services/publishing.service");
      books = await import("../src/services/book.service");
      posts = await import("../src/services/post.service");
      sessions = await import("../src/services/session.service");
      authorUser = await user("AUTHOR");
      otherUser = await user("AUTHOR");
      reader = await user("READER");
      admin = await user("ADMIN");
      for (const uid of [authorUser, otherUser]) {
        const [a]: any = await pool.query(
          "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Membership QA',1)",
          [uid],
        );
        if (uid === authorUser) authorId = a.insertId;
        else otherAuthor = a.insertId;
      }
      originalPolicy = await memberships.getMembershipPolicy();
      app.use(express.json({ limit: "1mb" }));
      app.use(cookieParser());
      app.use((await import("../src/routes")).default);
      app.use((e: any, _req: any, res: any, _next: any) =>
        res.status(e.status ?? 500).json({ message: e.message }),
      );
    }, 30000);
    afterAll(async () => {
      if (originalPolicy && admin) {
        const current = await memberships.getMembershipPolicy();
        await memberships.updateMembershipPolicy(admin, {
          ...originalPolicy,
          version: current.version,
        });
      }
      await pool?.end();
      await redis?.closeRedis();
    });
    it("creates at most two managed author tiers under concurrent writes and rejects client prices", async () => {
      const body = {
        name: "Supporters",
        description: "Read early chapters",
        benefits: ["Member chapters"],
        available: true,
      };
      const results = await Promise.all([
        memberships.saveTier(authorUser, 1, body),
        memberships.saveTier(authorUser, 1, body),
      ]);
      expect(results[0].tier!.id).toBe(results[1].tier!.id);
      tierOne = results[0].tier!.id;
      tierTwo = (
        await memberships.saveTier(authorUser, 2, { ...body, name: "Patrons" })
      ).tier!.id;
      foreignTier = (
        await memberships.saveTier(otherUser, 1, {
          ...body,
          name: "Foreign supporters",
        })
      ).tier!.id;
      expect(
        (await memberships.myTiers(authorUser)).tiers.filter(
          (t) => t.level !== null,
        ),
      ).toHaveLength(2);
      await expect(
        memberships.saveTier(authorUser, 3, body),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        memberships.saveTier(authorUser, 1, { ...body, priceCents: 1 }),
      ).rejects.toMatchObject({ status: 400 });
      expect(
        (await memberships.myTiers(authorUser)).tiers.find(
          (t) => t.id === tierOne,
        )!.priceCents,
      ).toBe(originalPolicy.tierOneCents);
    });
    it("audits admin pricing changes and rejects readers, invalid shares and stale versions", async () => {
      await expect(
        memberships.updateMembershipPolicy(reader, { ...originalPolicy }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        memberships.updateMembershipPolicy(admin, {
          ...originalPolicy,
          revenueShareBps: 10001,
        }),
      ).rejects.toMatchObject({ status: 400 });
      const changed = await memberships.updateMembershipPolicy(admin, {
        ...originalPolicy,
        tierOneCents: originalPolicy.tierOneCents + 1,
      });
      expect(changed.version).toBe(originalPolicy.version + 1);
      await expect(
        memberships.updateMembershipPolicy(admin, { ...originalPolicy }),
      ).rejects.toMatchObject({ status: 409 });
      const [[count]]: any = await pool.query(
        "SELECT COUNT(*) AS n FROM admin_audit_logs WHERE admin_user_id=? AND action='MEMBERSHIP_POLICY_UPDATED'",
        [admin],
      );
      expect(count.n).toBe(1);
    });
    it("blocks a public child of a members-only book before returning warmed content", async () => {
      const book = await publishing.savePublication(
        authorUser,
        {
          title: "Membership novel",
          genre: "Novel",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          requestId: randomUUID(),
        },
        "book",
      );
      bookId = book.id;
      slug = book.slug;
      const chapter = await publishing.savePublication(
        authorUser,
        {
          title: "A public opening",
          contentMd: "Paid-parent regression text",
          isDraft: false,
          requestId: randomUUID(),
        },
        "chapter",
        bookId,
      );
      chapterId = chapter.chapterId;
      chapterNo = chapter.chapterNo;
      expect(
        (await books.getChapterContent(slug, chapterNo)).contentMarkdown,
      ).toBe("Paid-parent regression text");
      await publishing.savePublication(
        authorUser,
        { visibility: "MEMBERS", requestId: randomUUID() },
        "book",
        bookId,
      );
      await expect(
        books.getChapterContent(slug, chapterNo),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        books.getChapterContent(slug, chapterNo, reader),
      ).rejects.toMatchObject({ status: 403 });
      const toc = await books.listChapterHeaders(slug, reader);
      expect(toc.items[0].isLockedForCurrentUser).toBe(true);
      expect(
        (await books.getChapterContent(slug, chapterNo, authorUser))
          .contentMarkdown,
      ).toContain("regression");
    });
    it("scopes real membership rows to the author and evaluates tier hierarchy across chapters/posts/chat", async () => {
      const [foreign]: any = await pool.query(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,current_period_end,provider) VALUES (?,?,?,'ACTIVE',DATE_ADD(NOW(),INTERVAL 1 MONTH),'MANUAL')",
        [reader, otherAuthor, foreignTier],
      );
      await expect(
        books.getChapterContent(slug, chapterNo, reader),
      ).rejects.toMatchObject({ status: 403 });
      const [member]: any = await pool.query(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,current_period_end,provider) VALUES (?,?,?,'ACTIVE',DATE_ADD(NOW(),INTERVAL 1 MONTH),'MANUAL')",
        [reader, authorId, tierOne],
      );
      memberId = member.insertId;
      await publishing.savePublication(
        authorUser,
        {
          visibility: "TIERS",
          requiredTierIds: [tierTwo],
          requestId: randomUUID(),
        },
        "chapter",
        bookId,
        chapterId,
      );
      await expect(
        books.getChapterContent(slug, chapterNo, reader),
      ).rejects.toMatchObject({ status: 403 });
      postId = (
        await posts.savePost(authorUser, {
          title: "Member news",
          body: "Exclusive post text",
          visibility: "TIERS",
          minimumTierId: tierTwo,
          isDraft: false,
        })
      ).id!;
      await expect(
        posts.getPublicPost(authorId, postId, reader),
      ).rejects.toMatchObject({ status: 403 });
      const teaser = await posts.listPublicPosts(authorId, reader);
      expect(teaser.items[0]).not.toHaveProperty("body");
      expect(teaser.items[0].isLocked).toBe(true);
      await pool.query("UPDATE memberships SET tier_id=? WHERE id=?", [
        tierTwo,
        memberId,
      ]);
      expect(
        (await books.getChapterContent(slug, chapterNo, reader))
          .contentMarkdown,
      ).toContain("regression");
      expect((await posts.getPublicPost(authorId, postId, reader)).body).toBe(
        "Exclusive post text",
      );
      expect(
        access.canJoinAuthorChat(
          await access.loadEntitlementContext(reader, authorId),
        ).allowed,
      ).toBe(true);
      await publishing.savePublication(
        authorUser,
        { requiredTierIds: [tierOne], requestId: randomUUID() },
        "chapter",
        bookId,
        chapterId,
      );
      expect(
        (await books.listChapterHeaders(slug, reader)).items[0]
          .isLockedForCurrentUser,
      ).toBe(false);
      await pool.query("UPDATE memberships SET status='EXPIRED' WHERE id=?", [
        foreign.insertId,
      ]);
      expect(
        access.canJoinAuthorChat(
          await access.loadEntitlementContext(reader, otherAuthor),
        ).allowed,
      ).toBe(false);
    });
    it("preserves an overlapping legacy grant without letting another author’s membership qualify", async () => {
      const [tier]: any = await pool.query(
        "INSERT INTO membership_tiers(author_id,name,price,currency) VALUES (?,?,'9.00','USD')",
        [authorId, `Earlier plan ${randomUUID()}`],
      );
      const [grant]: any = await pool.query(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,current_period_end,provider) VALUES (?,?,?,'ACTIVE',DATE_ADD(NOW(),INTERVAL 1 MONTH),'MANUAL')",
        [reader, authorId, tier.insertId],
      );
      const post = await posts.savePost(authorUser, {
        title: "Earlier-plan update",
        body: "A preserved legacy entitlement.",
        visibility: "TIERS",
        minimumTierId: tier.insertId,
        isDraft: false,
      });
      expect(
        (await posts.getPublicPost(authorId, post.id, reader)).body,
      ).toContain("preserved");
      await pool.query("UPDATE memberships SET status='EXPIRED' WHERE id=?", [
        grant.insertId,
      ]);
      await expect(
        posts.getPublicPost(authorId, post.id, reader),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("checks expiry, future starts, cancellation and disabled-selling tiers consistently", async () => {
      for (const update of [
        "current_period_end=DATE_SUB(NOW(),INTERVAL 1 SECOND)",
        "started_at=DATE_ADD(NOW(),INTERVAL 1 DAY)",
        "status='CANCELED'",
        "status='PAST_DUE'",
      ]) {
        await pool.query(
          `UPDATE memberships SET status='ACTIVE',started_at=DATE_SUB(NOW(),INTERVAL 1 DAY),current_period_end=DATE_ADD(NOW(),INTERVAL 1 MONTH),${update} WHERE id=?`,
          [memberId],
        );
        await expect(
          books.getChapterContent(slug, chapterNo, reader),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          posts.getPublicPost(authorId, postId, reader),
        ).rejects.toMatchObject({ status: 403 });
        expect(
          access.canJoinAuthorChat(
            await access.loadEntitlementContext(reader, authorId),
          ).allowed,
        ).toBe(false);
      }
      await pool.query(
        "UPDATE memberships SET status='ACTIVE',started_at=DATE_SUB(NOW(),INTERVAL 1 DAY),current_period_end=DATE_ADD(NOW(),INTERVAL 1 MONTH),auto_renew=0 WHERE id=?",
        [memberId],
      );
      await memberships.saveTier(authorUser, 2, {
        name: "Patrons",
        benefits: [],
        available: false,
      });
      expect(
        (await memberships.publicAuthorTiers(authorId)).tiers.some(
          (t) => t.id === tierTwo,
        ),
      ).toBe(false);
      expect(
        (await books.getChapterContent(slug, chapterNo, reader))
          .contentMarkdown,
      ).toContain("regression");
      expect(
        (await memberships.myMemberships(reader)).items.find(
          (m) => m.id === memberId,
        )!.autoRenew,
      ).toBe(false);
      await expect(
        memberships.cancelMembership(authorUser, memberId),
      ).rejects.toMatchObject({ status: 404 });
      await pool.query("UPDATE memberships SET auto_renew=1 WHERE id=?", [
        memberId,
      ]);
      expect(
        await memberships.cancelMembership(reader, memberId),
      ).toMatchObject({ autoRenew: false, status: "ACTIVE" });
      expect(
        await memberships.cancelMembership(reader, memberId),
      ).toMatchObject({ autoRenew: false, status: "ACTIVE" });
      expect(
        access.canJoinAuthorChat(
          await access.loadEntitlementContext(reader, authorId),
        ).allowed,
      ).toBe(true);
    });
    it("rejects foreign tier attachment, foreign post writes and scheduled release exposure", async () => {
      await expect(
        publishing.savePublication(
          authorUser,
          { requiredTierIds: [foreignTier], requestId: randomUUID() },
          "chapter",
          bookId,
          chapterId,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        posts.savePost(otherUser, { title: "Foreign edit" }, postId),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        posts.savePost(authorUser, {
          title: "Foreign tier",
          body: "Not public",
          visibility: "TIERS",
          minimumTierId: foreignTier,
          isDraft: false,
        }),
      ).rejects.toMatchObject({ status: 403 });
      await publishing.savePublication(
        authorUser,
        {
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
          requestId: randomUUID(),
        },
        "chapter",
        bookId,
        chapterId,
      );
      await expect(
        books.getChapterContent(slug, chapterNo, reader),
      ).rejects.toMatchObject({ status: 404 });
      expect((await books.listChapterHeaders(slug, reader)).items).toHaveLength(
        0,
      );
      await publishing.savePublication(
        authorUser,
        { scheduledAt: null, requestId: randomUUID() },
        "chapter",
        bookId,
        chapterId,
      );
    });
    it("enforces reader/author/admin HTTP boundaries and omits protected post bodies", async () => {
      const readerTokens = await sessions.issueSession(reader),
        authorTokens = await sessions.issueSession(authorUser);
      const readerHeaders = {
          "x-client-id": String(reader),
          Authorization: `Bearer ${readerTokens.accessToken}`,
        },
        authorHeaders = {
          "x-client-id": String(authorUser),
          Authorization: `Bearer ${authorTokens.accessToken}`,
        };
      expect(
        (await request(app).get("/v1/api/authors/me/tiers").set(readerHeaders))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put("/v1/api/admin/membership-policy")
            .set(authorHeaders)
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (await request(app).get(`/v1/api/authors/${authorId}/posts/${postId}`))
          .status,
      ).toBe(401);
      const list = await request(app).get(`/v1/api/authors/${authorId}/posts`);
      expect(list.status).toBe(200);
      expect(list.headers["cache-control"]).toBe("no-store");
      expect(list.body.metadata.items[0]).not.toHaveProperty("body");
      const own = await request(app)
        .get("/v1/api/authors/me/members")
        .set(authorHeaders);
      expect(own.status).toBe(200);
      expect(
        own.body.metadata.items.some((m: any) => m.userId === reader),
      ).toBe(true);
    });
    it("rejects fresh reads for suspended authors and hidden books even after cache warmup", async () => {
      await books.getBookDetailBySlug(slug);
      await pool.query("UPDATE books SET status='HIDDEN' WHERE id=?", [bookId]);
      await expect(books.getBookDetailBySlug(slug)).rejects.toMatchObject({
        status: 404,
      });
      await pool.query("UPDATE books SET status='PUBLISHED' WHERE id=?", [
        bookId,
      ]);
      await pool.query("UPDATE authors SET is_approved=0 WHERE id=?", [
        authorId,
      ]);
      expect(
        (await memberships.myMemberships(reader)).items.find(
          (m) => Number(m.id) === memberId,
        )!.hasAccess,
      ).toBe(false);
      await expect(
        books.getChapterContent(slug, chapterNo, reader),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        posts.getPublicPost(authorId, postId, reader),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        access.canJoinAuthorChat(
          await access.loadEntitlementContext(reader, authorId),
        ).allowed,
      ).toBe(false);
      await pool.query("UPDATE authors SET is_approved=1 WHERE id=?", [
        authorId,
      ]);
    });
  },
);
