import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../core/error.response";
import { positiveId, boundedText, booleanValue } from "../domain/validation";
import { ownedAuthor } from "./membership.service";
import {
  assertEntitled,
  canViewPost,
  loadEntitlementContext,
  type TierRule,
  type Visibility,
} from "./entitlement.service";
import { findAvailableAuthor } from "../models/repositories/membership.repo";
import { notHiddenSql } from "../models/repositories/publicationVisibility.sql";

export async function savePost(
  userId: number,
  body: Record<string, unknown>,
  idValue?: unknown,
) {
  const id = idValue === undefined ? null : positiveId(idValue, "post");
  return withTransaction(async (db) => {
    const author = await ownedAuthor(userId, db, true),
      authorId = Number(author.id);
    const [rows] = id
      ? await db.query<RowDataPacket[]>(
          "SELECT * FROM author_posts WHERE id=? AND author_id=? AND deleted_at IS NULL FOR UPDATE",
          [id, authorId],
        )
      : [[]];
    const old = rows[0];
    if (id && !old) throw new NotFoundError("Post unavailable");
    const title = boundedText(body.title ?? old?.title, "Post title", 180),
      content = boundedText(
        body.body ?? old?.body ?? "",
        "Post text",
        20000,
        false,
      );
    const visibility = body.visibility ?? old?.visibility ?? "PUBLIC";
    if (!["PUBLIC", "MEMBERS", "TIERS"].includes(String(visibility)))
      throw new BadRequestError("Invalid post visibility");
    const draft =
      body.isDraft === undefined
        ? Boolean(old?.is_draft ?? true)
        : booleanValue(body.isDraft, "Draft");
    if (!draft && !content)
      throw new BadRequestError("Add post text before publishing");
    const minimum =
      visibility === "TIERS"
        ? positiveId(body.minimumTierId ?? old?.minimum_tier_id, "minimum tier")
        : null;
    if (minimum) {
      const [tiers] = await db.query<RowDataPacket[]>(
        "SELECT id FROM membership_tiers WHERE id=? AND author_id=?",
        [minimum, authorId],
      );
      if (!tiers.length)
        throw new ForbiddenError("Tier belongs to another author");
    }
    let postId = id;
    if (id)
      await db.query(
        "UPDATE author_posts SET title=?,body=?,visibility=?,minimum_tier_id=?,is_draft=?,published_at=IF(?=1,NULL,COALESCE(published_at,NOW())) WHERE id=?",
        [title, content, visibility, minimum, Number(draft), Number(draft), id],
      );
    else {
      const [result] = await db.query<ResultSetHeader>(
        "INSERT INTO author_posts(author_id,title,body,visibility,minimum_tier_id,is_draft,published_at) VALUES (?,?,?,?,?,?,IF(?=1,NULL,NOW()))",
        [
          authorId,
          title,
          content,
          visibility,
          minimum,
          Number(draft),
          Number(draft),
        ],
      );
      postId = result.insertId;
    }
    return { id: postId, authorId, isDraft: draft };
  });
}
export async function myPosts(userId: number) {
  const author = await ownedAuthor(userId);
  const [items] = await pool.query<RowDataPacket[]>(
    "SELECT p.id,p.title,p.body,p.visibility,p.minimum_tier_id AS minimumTierId,p.is_draft AS isDraft,UNIX_TIMESTAMP(p.published_at) AS publishedEpoch,COALESCE(f.hidden,0) AS moderationHidden,f.reason AS moderationReason FROM author_posts p LEFT JOIN moderation_flags f ON f.kind='POST' AND f.resource_id=p.id WHERE p.author_id=? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 100",
    [author.id],
  );
  return {
    items: items.map((row) => ({
      ...row,
      isDraft: Boolean(row.isDraft),
      moderationHidden: Boolean(row.moderationHidden),
    })),
  };
}
function postRule(row: RowDataPacket): TierRule[] {
  return row.minimum_tier_id
    ? [
        {
          tierId: Number(row.minimum_tier_id),
          level: row.level === null ? null : Number(row.level),
        },
      ]
    : [];
}
export async function listPublicPosts(
  authorValue: unknown,
  userId?: number,
  cursorValue?: unknown,
) {
  const authorId = positiveId(authorValue, "author");
  if (!(await findAvailableAuthor(authorId)))
    throw new NotFoundError("Author unavailable");
  const cursor =
      cursorValue === undefined
        ? Number.MAX_SAFE_INTEGER
        : positiveId(cursorValue, "cursor"),
    context = await loadEntitlementContext(userId, authorId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*,l.level,UNIX_TIMESTAMP(p.published_at) AS publishedEpoch FROM author_posts p LEFT JOIN membership_tier_levels l ON l.tier_id=p.minimum_tier_id
    WHERE p.author_id=? AND p.id<? AND p.deleted_at IS NULL AND p.is_draft=0 AND p.published_at<=NOW() AND ${notHiddenSql("POST", "p")} ORDER BY p.id DESC LIMIT 21`,
    [authorId, cursor],
  );
  return {
    items: rows.slice(0, 20).map((row) => {
      const decision = canViewPost(context, {
        released: true,
        visibility: row.visibility as Visibility,
        rules: postRule(row),
      });
      return {
        id: Number(row.id),
        authorId,
        title: row.title,
        visibility: row.visibility,
        publishedAt: new Date(Number(row.publishedEpoch) * 1000).toISOString(),
        isLocked: !decision.allowed,
        ...(decision.allowed
          ? { body: row.body }
          : { accessReason: decision.reason }),
      };
    }),
    nextCursor: rows.length > 20 ? Number(rows[19].id) : null,
  };
}
export async function getPublicPost(
  authorValue: unknown,
  idValue: unknown,
  userId?: number,
) {
  const authorId = positiveId(authorValue, "author"),
    id = positiveId(idValue, "post");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*,l.level,(p.is_draft=0 AND p.published_at<=NOW()) AS released FROM author_posts p LEFT JOIN membership_tier_levels l ON l.tier_id=p.minimum_tier_id WHERE p.id=? AND p.author_id=? AND p.deleted_at IS NULL AND ${notHiddenSql("POST", "p")}`,
    [id, authorId],
  );
  if (!rows[0]) throw new NotFoundError("Post unavailable");
  const row = rows[0],
    context = await loadEntitlementContext(userId, authorId);
  assertEntitled(
    canViewPost(context, {
      released: Boolean(row.released),
      visibility: row.visibility,
      rules: postRule(row),
    }),
  );
  return {
    id,
    authorId,
    title: row.title,
    body: row.body,
    visibility: row.visibility,
  };
}
