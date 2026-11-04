import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../dbs/init.mysql";
import {
  publicBookSql,
  releasedChapterSql,
  notHiddenSql,
  type ContentKind,
} from "./publicationVisibility.sql";
export const contentTables = {
  BOOK: "books",
  CHAPTER: "chapters",
  POST: "author_posts",
} as const;
export async function moderationNotice(kind: ContentKind, id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT hidden,reason FROM moderation_flags WHERE kind=? AND resource_id=?",
    [kind, id],
  );
  return {
    moderationHidden: Boolean(rows[0]?.hidden),
    moderationReason: rows[0]?.hidden ? rows[0].reason : null,
  };
}
export async function findModerationTarget(
  kind: ContentKind,
  id: number,
  db: Pick<PoolConnection, "query"> = pool,
  lock = false,
) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT r.id,r.author_id,r.title FROM ${contentTables[kind]} r WHERE r.id=? AND r.deleted_at IS NULL ${lock ? "FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0];
}
export async function isReportable(
  kind: ContentKind,
  id: number,
  db: Pick<PoolConnection, "query">,
) {
  let predicate: string;
  if (kind === "BOOK") predicate = publicBookSql("r");
  else if (kind === "CHAPTER")
    predicate = `${releasedChapterSql("r")} AND EXISTS(SELECT 1 FROM books b WHERE b.id=r.book_id AND ${publicBookSql("b")})`;
  else
    predicate = `r.deleted_at IS NULL AND r.is_draft=0 AND r.published_at<=NOW() AND ${notHiddenSql("POST", "r")} AND EXISTS(SELECT 1 FROM authors a JOIN users u ON u.id=a.user_id WHERE a.id=r.author_id AND a.is_approved=1 AND u.state=1)`;
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT r.id FROM ${contentTables[kind]} r WHERE r.id=? AND ${predicate}`,
    [id],
  );
  return rows.length > 0;
}
export async function listModerationContent(
  kind: ContentKind,
  cursor: number,
  query: string,
) {
  const state =
    kind === "BOOK"
      ? "r.status"
      : "IF(r.is_draft=1,'DRAFT',IF(r.published_at>NOW(),'SCHEDULED','PUBLISHED'))";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id,r.title,r.author_id AS authorId,a.pen_name AS authorName,${state} AS publicationState,r.visibility,
    COALESCE(f.hidden,0) AS hidden,COALESCE(f.version,0) AS moderationVersion,f.reason AS moderationReason
    FROM ${contentTables[kind]} r JOIN authors a ON a.id=r.author_id LEFT JOIN moderation_flags f ON f.kind=? AND f.resource_id=r.id
    WHERE r.deleted_at IS NULL AND r.id<? AND (r.title LIKE ? OR a.pen_name LIKE ? OR CAST(r.id AS CHAR)=?) ORDER BY r.id DESC LIMIT 51`,
    [kind, cursor, `%${query}%`, `%${query}%`, query],
  );
  return rows;
}
