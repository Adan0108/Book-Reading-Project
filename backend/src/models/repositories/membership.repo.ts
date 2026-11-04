import { pool } from "../../dbs/init.mysql";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { BadRequestError, ForbiddenError } from "../../core/error.response";
import type { TierRule } from "../../services/entitlement.service";
import { activeMembershipSql } from "./membershipAccess.sql";
type Database = Pick<PoolConnection, "query">;

export const getActiveMemberships = async (
  userId: number,
  authorId: number,
  db: Database = pool,
) => {
  const [rows] = await db.query(
    `SELECT m.id,m.user_id,m.author_id,m.tier_id,m.status,m.current_period_end,l.level
     FROM memberships m JOIN users u ON u.id=m.user_id AND u.state=1
     JOIN membership_tiers t ON t.id=m.tier_id AND t.author_id=m.author_id
     LEFT JOIN membership_tier_levels l ON l.tier_id=t.id
     WHERE m.user_id = ? AND m.author_id = ?
       AND ${activeMembershipSql}
     ORDER BY COALESCE(l.level,0) DESC,m.current_period_end DESC
     `,
    [userId, authorId],
  );
  return rows as RowDataPacket[];
};

export async function findAvailableAuthor(
  authorId: number,
  db: Database = pool,
) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT a.id,a.user_id,a.pen_name FROM authors a JOIN users u ON u.id=a.user_id WHERE a.id=? AND a.is_approved=1 AND u.state=1",
    [authorId],
  );
  return rows[0] ?? null;
}
export async function isActiveAdmin(userId: number, db: Database = pool) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id WHERE ur.user_id=? AND r.code='ADMIN' AND u.state=1 LIMIT 1",
    [userId],
  );
  return rows.length > 0;
}
export async function getTierRules(
  kind: "book" | "chapter",
  id: number,
  authorId: number,
  db: Database = pool,
): Promise<TierRule[]> {
  const table = kind === "book" ? "book_tier_access" : "chapter_tier_access",
    column = kind === "book" ? "book_id" : "chapter_id";
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT a.tier_id,l.level FROM ${table} a LEFT JOIN membership_tier_levels l ON l.tier_id=a.tier_id WHERE a.${column}=? AND a.author_id=?`,
    [id, authorId],
  );
  return rows.map((row) => ({
    tierId: Number(row.tier_id),
    level: row.level === null ? null : Number(row.level),
  }));
}
export async function getChapterTierRules(
  bookId: number,
  authorId: number,
): Promise<Map<number, TierRule[]>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.chapter_id,a.tier_id,l.level FROM chapter_tier_access a JOIN chapters c ON c.id=a.chapter_id LEFT JOIN membership_tier_levels l ON l.tier_id=a.tier_id WHERE c.book_id=? AND a.author_id=?`,
    [bookId, authorId],
  );
  const result = new Map<number, TierRule[]>();
  for (const row of rows) {
    const id = Number(row.chapter_id);
    const list = result.get(id) ?? [];
    list.push({
      tierId: Number(row.tier_id),
      level: row.level === null ? null : Number(row.level),
    });
    result.set(id, list);
  }
  return result;
}
export async function setResourceTiers(
  db: Database,
  kind: "book" | "chapter",
  id: number,
  authorId: number,
  visibility: string,
  value: unknown,
) {
  if (value === undefined) {
    if (
      visibility === "TIERS" &&
      !(await getTierRules(kind, id, authorId, db)).length
    )
      throw new BadRequestError(
        "Select a membership tier before saving tier-restricted content",
      );
    return;
  }
  if (
    !Array.isArray(value) ||
    value.length > 2 ||
    value.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    new Set(value).size !== value.length
  )
    throw new BadRequestError("Choose at most two valid author tiers");
  if (visibility === "TIERS" && !value.length)
    throw new BadRequestError("Choose a required membership tier");
  if (value.length) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id FROM membership_tiers WHERE author_id=? AND id IN (${value.map(() => "?").join(",")})`,
      [authorId, ...value],
    );
    if (rows.length !== value.length)
      throw new ForbiddenError("A membership tier belongs to another author");
  }
  const table = kind === "book" ? "book_tier_access" : "chapter_tier_access",
    column = kind === "book" ? "book_id" : "chapter_id";
  await db.query(`DELETE FROM ${table} WHERE ${column}=? AND author_id=?`, [
    id,
    authorId,
  ]);
  for (const tierId of value)
    await db.query(
      `INSERT INTO ${table}(${column},author_id,tier_id) VALUES (?,?,?)`,
      [id, authorId, tierId],
    );
}
