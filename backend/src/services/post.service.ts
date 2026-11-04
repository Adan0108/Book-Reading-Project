import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { randomUUID, createHash } from "crypto";
import {
  attachable,
  postImages,
} from "../models/repositories/publishingAsset.repo";
import { validateAssetIds } from "./publishing.service";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictRequestError,
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
  const requestId = body.requestId ?? randomUUID();
  if (
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId,
    )
  )
    throw new BadRequestError("Invalid requestId");
  const hash = createHash("sha256")
    .update(JSON.stringify({ body, kind: "post", id }))
    .digest("hex");
  return withTransaction(async (db) => {
    const author = await ownedAuthor(userId, db, true),
      authorId = Number(author.id);
    const [requests] = await db.query<RowDataPacket[]>(
      "SELECT * FROM publishing_requests WHERE author_id=? AND request_id=?",
      [authorId, requestId],
    );
    if (requests[0]) {
      if (requests[0].payload_hash !== hash)
        throw new ConflictRequestError(
          "This save key was already used for different content",
        );
      return typeof requests[0].result_json === "string"
        ? JSON.parse(requests[0].result_json)
        : requests[0].result_json;
    }
    const [rows] = id
      ? await db.query<RowDataPacket[]>(
          "SELECT * FROM author_posts WHERE id=? AND author_id=? AND deleted_at IS NULL FOR UPDATE",
          [id, authorId],
        )
      : [[]];
    const old = rows[0];
    if (id && !old) throw new NotFoundError("Post unavailable");
    const [details] = id
      ? await db.query<RowDataPacket[]>(
          "SELECT is_spoiler FROM post_details WHERE post_id=?",
          [id],
        )
      : [[]];
    const spoiler =
      body.isSpoiler === undefined
        ? Boolean(details[0]?.is_spoiler)
        : booleanValue(body.isSpoiler, "Spoiler");
    const ids =
      body.imageAssetIds ??
      (id ? (await postImages([id], db)).map((i) => i.id) : []);
    validateAssetIds(ids);
    if (ids.length > 8)
      throw new BadRequestError("A post can have up to eight optional images");
    for (const assetId of ids)
      await attachable(
        db,
        assetId,
        authorId,
        "post",
        undefined,
        undefined,
        id ?? undefined,
      );
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
    await db.query(
      "INSERT INTO post_details(post_id,is_spoiler) VALUES (?,?) ON DUPLICATE KEY UPDATE is_spoiler=VALUES(is_spoiler)",
      [postId, Number(spoiler)],
    );
    await db.query("DELETE FROM post_images WHERE post_id=?", [postId]);
    for (let index = 0; index < ids.length; index++)
      await db.query(
        "INSERT INTO post_images(post_id,asset_id,image_order) VALUES (?,?,?)",
        [postId, ids[index], index + 1],
      );
    const result = { id: postId, authorId, isDraft: draft };
    await db.query(
      "INSERT INTO publishing_requests(author_id,request_id,payload_hash,result_json) VALUES (?,?,?,?)",
      [authorId, requestId, hash, JSON.stringify(result)],
    );
    return result;
  });
}
export async function myPosts(userId: number, cursorValue?: unknown) {
  const author = await ownedAuthor(userId);
  const cursor =
    cursorValue === undefined
      ? Number.MAX_SAFE_INTEGER
      : positiveId(cursorValue, "cursor");
  const [items] = await pool.query<RowDataPacket[]>(
    "SELECT p.id,p.title,p.body,p.visibility,p.minimum_tier_id AS minimumTierId,p.is_draft AS isDraft,COALESCE(d.is_spoiler,0) AS isSpoiler,UNIX_TIMESTAMP(p.published_at) AS publishedEpoch,COALESCE(f.hidden,0) AS moderationHidden,f.reason AS moderationReason FROM author_posts p LEFT JOIN post_details d ON d.post_id=p.id LEFT JOIN moderation_flags f ON f.kind='POST' AND f.resource_id=p.id WHERE p.author_id=? AND p.id<? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 51",
    [author.id, cursor],
  );
  const images = await postImages(items.slice(0, 50).map((i) => Number(i.id)));
  return {
    nextCursor: items.length > 50 ? Number(items[49].id) : null,
    items: items.slice(0, 50).map((row) => ({
      ...row,
      isDraft: Boolean(row.isDraft),
      isSpoiler: Boolean(row.isSpoiler),
      images: images.filter((i) => i.postId === Number(row.id)),
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
    `SELECT p.*,COALESCE(d.is_spoiler,0) AS is_spoiler,l.level,UNIX_TIMESTAMP(p.published_at) AS publishedEpoch FROM author_posts p LEFT JOIN post_details d ON d.post_id=p.id LEFT JOIN membership_tier_levels l ON l.tier_id=p.minimum_tier_id
    WHERE p.author_id=? AND p.id<? AND p.deleted_at IS NULL AND p.is_draft=0 AND p.published_at<=NOW() AND ${notHiddenSql("POST", "p")} ORDER BY p.id DESC LIMIT 21`,
    [authorId, cursor],
  );
  const items = rows.slice(0, 20).map((row) => ({
    row,
    decision: canViewPost(context, {
      released: true,
      visibility: row.visibility as Visibility,
      rules: postRule(row),
    }),
  }));
  const images = await postImages(
    items.filter((i) => i.decision.allowed).map((i) => Number(i.row.id)),
  );
  return {
    items: items.map(({ row, decision }) => {
      return {
        id: Number(row.id),
        authorId,
        title: row.title,
        visibility: row.visibility,
        publishedAt: new Date(Number(row.publishedEpoch) * 1000).toISOString(),
        isLocked: !decision.allowed,
        isSpoiler: Boolean(row.is_spoiler),
        ...(decision.allowed
          ? {
              body: row.body,
              images: images.filter((i) => i.postId === Number(row.id)),
            }
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
    `SELECT p.*,COALESCE(d.is_spoiler,0) AS is_spoiler,l.level,(p.is_draft=0 AND p.published_at<=NOW()) AS released FROM author_posts p LEFT JOIN post_details d ON d.post_id=p.id LEFT JOIN membership_tier_levels l ON l.tier_id=p.minimum_tier_id WHERE p.id=? AND p.author_id=? AND p.deleted_at IS NULL AND ${notHiddenSql("POST", "p")}`,
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
    isSpoiler: Boolean(row.is_spoiler),
    images: await postImages([id]),
  };
}
