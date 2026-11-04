import type {
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
import {
  BadRequestError,
  ConflictRequestError,
  ForbiddenError,
  NotFoundError,
  ErrorResponse,
} from "../core/error.response";
import {
  positiveId,
  boundedText,
  booleanValue,
  integerRange,
} from "../domain/validation";
import { isActiveAdmin } from "../models/repositories/membership.repo";
import * as repository from "../models/repositories/moderation.repo";
import {postImages} from '../models/repositories/publishingAsset.repo';
import {
  publicBookSql,
  releasedChapterSql,
  type ContentKind,
} from "../models/repositories/publicationVisibility.sql";
import { activeMembershipSql } from "../models/repositories/membershipAccess.sql";
import { cacheDel } from "../utils/cache";
import { getChapterDocument } from "../models/repositories/chapterDocument.repo";
import { getChapterImages } from "./publishing.service";

export function contentKind(value: unknown): ContentKind {
  if (value !== "BOOK" && value !== "CHAPTER" && value !== "POST")
    throw new BadRequestError("Invalid content kind");
  return value;
}
function cursor(value: unknown) {
  return value === undefined
    ? Number.MAX_SAFE_INTEGER
    : positiveId(value, "cursor");
}
async function admin(db: Pick<PoolConnection, "query">, userId: number) {
  if (!(await isActiveAdmin(userId, db)))
    throw new ForbiddenError("Administrator access required");
}
async function audit(
  db: PoolConnection,
  userId: number,
  action: string,
  target: string,
  details: unknown,
) {
  await db.query(
    "INSERT INTO admin_audit_logs(admin_user_id,action,target,details_json) VALUES (?,?,?,?)",
    [userId, action, target, JSON.stringify(details)],
  );
}
export async function moderationPolicy(
  db: Pick<PoolConnection, "query"> = pool,
) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT reports_enabled AS reportsEnabled,reports_per_day AS reportsPerDay,version FROM platform_moderation_policy WHERE id=1",
  );
  return {
    reportsEnabled: Boolean(rows[0].reportsEnabled),
    reportsPerDay: Number(rows[0].reportsPerDay),
    version: Number(rows[0].version),
  };
}
export async function saveModerationPolicy(
  userId: number,
  body: Record<string, unknown>,
) {
  const enabled = booleanValue(body.reportsEnabled, "Reports enabled"),
    limit = integerRange(body.reportsPerDay, "Reports per day", 1, 20),
    version = positiveId(body.version, "version"),
    reason = boundedText(body.reason, "Reason", 2000);
  return withTransaction(async (db) => {
    await db.query(
      "SELECT id FROM platform_moderation_policy WHERE id=1 FOR UPDATE",
    );
    await admin(db, userId);
    const before = await moderationPolicy(db);
    if (Number(before.version) !== version)
      throw new ConflictRequestError("Settings changed. Reload before saving.");
    await db.query(
      "UPDATE platform_moderation_policy SET reports_enabled=?,reports_per_day=?,version=version+1 WHERE id=1",
      [Number(enabled), limit],
    );
    const after = await moderationPolicy(db);
    await audit(db, userId, "MODERATION_POLICY_UPDATED", "moderation-policy", {
      before,
      after,
      reason,
    });
    return after;
  });
}
export async function dashboard() {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM users) AS totalUsers,
    (SELECT COUNT(*) FROM authors a JOIN users u ON u.id=a.user_id WHERE a.is_approved=1 AND u.state=1) AS totalAuthors,
    (SELECT COUNT(*) FROM books b WHERE ${publicBookSql("b")}) AS publishedBooks,
    (SELECT COUNT(*) FROM chapters c JOIN books b ON b.id=c.book_id WHERE ${publicBookSql("b")} AND ${releasedChapterSql("c")}) AS publishedChapters,
    (SELECT COALESCE(SUM(views_count),0) FROM books) AS recordedBookViews,
    (SELECT COUNT(*) FROM memberships m JOIN users u ON u.id=m.user_id JOIN authors a ON a.id=m.author_id JOIN users au ON au.id=a.user_id WHERE ${activeMembershipSql} AND u.state=1 AND a.is_approved=1 AND au.state=1) AS activeMemberships,
    (SELECT COALESCE(SUM(p.gross_cents-p.refunded_cents),0) FROM billing_payments p JOIN billing_intents i ON i.id=p.intent_id WHERE i.kind='DONATION') AS sandboxDonationCents,
    (SELECT COUNT(*) FROM content_reports WHERE status IN ('OPEN','REVIEWING')) AS openReports`);
  return {
    ...Object.fromEntries(
      Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
    ),
    currency: "USD",
    financialMode: "sandbox",
  };
}
export async function listUsers(query: Record<string, unknown>) {
  const q = boundedText(query.query ?? "", "Search", 100, false),
    role = query.role;
  if (role !== undefined && role !== "AUTHOR")
    throw new BadRequestError("Invalid account filter");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id,u.email,u.state,p.username,a.id AS authorId,a.pen_name AS penName,a.is_approved AS approved,
    (SELECT GROUP_CONCAT(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id) AS roleCodes,
    (u.password_hash<>'---PENDING_SETUP---' AND u.state<>2) AS setupComplete
    FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN authors a ON a.user_id=u.id
    WHERE u.id<? AND (u.email LIKE ? OR p.username LIKE ? OR a.pen_name LIKE ?) ${role ? "AND a.id IS NOT NULL" : ""} ORDER BY u.id DESC LIMIT 51`,
    [cursor(query.cursor), `%${q}%`, `%${q}%`, `%${q}%`],
  );
  return {
    items: rows.slice(0, 50).map((r) => ({
      ...r,
      roles: typeof r.roleCodes === "string" ? r.roleCodes.split(",") : [],
      setupComplete: Boolean(r.setupComplete),
      approved: Boolean(r.approved),
    })),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
  };
}
export async function setAccountState(
  adminUserId: number,
  idValue: unknown,
  body: Record<string, unknown>,
) {
  const id = positiveId(idValue, "account"),
    active = booleanValue(body.active, "Active"),
    expected = integerRange(body.expectedState, "Expected state", 0, 1),
    reason = boundedText(body.reason, "Reason", 2000);
  if (id === adminUserId)
    throw new BadRequestError("You cannot change your own account state");
  return withTransaction(async (db) => {
    // Serialize administrative suspensions so two admins cannot concurrently suspend each other.
    await db.query(
      "SELECT id FROM platform_moderation_policy WHERE id=1 FOR UPDATE",
    );
    await admin(db, adminUserId);
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id,state,(password_hash='---PENDING_SETUP---') AS pending FROM users WHERE id=? FOR UPDATE",
      [id],
    );
    const target = users[0];
    if (!target) throw new NotFoundError("Account unavailable");
    if (target.pending || Number(target.state) === 2)
      throw new BadRequestError("Account setup must be completed by its owner");
    if (Number(target.state) !== expected)
      throw new ConflictRequestError("Account changed. Reload before saving.");
    await db.query("UPDATE users SET state=? WHERE id=?", [Number(active), id]);
    if (!active)
      await db.query(
        "UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=?",
        [id],
      );
    await audit(
      db,
      adminUserId,
      active ? "ACCOUNT_RESTORED" : "ACCOUNT_SUSPENDED",
      `user:${id}`,
      { before: Number(target.state), after: Number(active), reason },
    );
    return { id, state: Number(active) };
  });
}
export async function listContent(query: Record<string, unknown>) {
  const kind = contentKind(query.kind ?? "BOOK"),
    q = boundedText(query.query ?? "", "Search", 100, false),
    rows = await repository.listModerationContent(
      kind,
      cursor(query.cursor),
      q,
    );
  return {
    kind,
    items: rows.slice(0, 50).map((r) => ({ ...r, hidden: Boolean(r.hidden) })),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
  };
}
export async function contentDetail(kindValue: unknown, idValue: unknown) {
  const kind = contentKind(kindValue),
    id = positiveId(idValue, "content");
  if (!(await repository.findModerationTarget(kind, id)))
    throw new NotFoundError("Content unavailable");
  const table = repository.contentTables[kind];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT title,${kind === "BOOK" ? "synopsis" : kind === "POST" ? "body" : "content_md"} AS text,${kind === "BOOK" ? "cover_image_url" : "NULL"} AS coverUrl FROM ${table} WHERE id=?`,
    [id],
  );
  return {
    ...rows[0],
    kind,
    id,
    contentDocument: kind === "CHAPTER" ? await getChapterDocument(id) : null,
    images: kind === "CHAPTER" ? await getChapterImages(id) : kind === 'POST'?await postImages([id]):[],
  };
}
export async function setContentHidden(
  userId: number,
  kindValue: unknown,
  idValue: unknown,
  body: Record<string, unknown>,
) {
  const kind = contentKind(kindValue),
    id = positiveId(idValue, "content"),
    hidden = booleanValue(body.hidden, "Hidden"),
    version = integerRange(
      body.version,
      "Moderation version",
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    reason = boundedText(body.reason, "Reason", 2000);
  const result = await withTransaction(async (db) => {
    await admin(db, userId);
    const target = await repository.findModerationTarget(kind, id, db, true);
    if (!target) throw new NotFoundError("Content unavailable");
    const [flags] = await db.query<RowDataPacket[]>(
      "SELECT * FROM moderation_flags WHERE kind=? AND resource_id=? FOR UPDATE",
      [kind, id],
    );
    const before = flags[0];
    if (Number(before?.version ?? 0) !== version)
      throw new ConflictRequestError(
        "Moderation changed. Reload before saving.",
      );
    await db.query(
      "INSERT INTO moderation_flags(kind,resource_id,hidden,reason,admin_user_id) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE hidden=VALUES(hidden),reason=VALUES(reason),admin_user_id=VALUES(admin_user_id),version=version+1",
      [kind, id, Number(hidden), reason, userId],
    );
    await audit(
      db,
      userId,
      hidden ? "CONTENT_HIDDEN" : "CONTENT_RESTORED",
      `${kind}:${id}`,
      { before: Boolean(before?.hidden), after: hidden, reason },
    );
    return { id, kind, hidden, version: version + 1 };
  });
  // Body access is gated freshly before caches; invalidate descriptive counts as well.
  if (kind !== "POST") {
    const [books] = await pool.query<RowDataPacket[]>(
      kind === "BOOK"
        ? "SELECT slug FROM books WHERE id=?"
        : "SELECT b.slug FROM books b JOIN chapters c ON c.book_id=b.id WHERE c.id=?",
      [id],
    );
    if (books[0]) await cacheDel(`book:${books[0].slug}`).catch(() => {});
  }
  return result;
}
export async function createReport(
  userId: number,
  body: Record<string, unknown>,
) {
  const kind = contentKind(body.kind),
    id = positiveId(body.resourceId, "content"),
    reason = boundedText(body.reason, "Report reason", 2000);
  return withTransaction(async (db) => {
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id=? AND state=1 FOR UPDATE",
      [userId],
    );
    if (!users.length) throw new ForbiddenError("Active account required");
    const policy = await moderationPolicy(db);
    if (!policy.reportsEnabled)
      throw new ErrorResponse(
        "Content reports are temporarily unavailable",
        503,
      );
    if (!(await repository.isReportable(kind, id, db)))
      throw new NotFoundError("Published content unavailable");
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT id FROM content_reports WHERE reporter_user_id=? AND kind=? AND resource_id=? AND status IN ('OPEN','REVIEWING') LIMIT 1",
      [userId, kind, id],
    );
    if (existing[0]) return { id: Number(existing[0].id), status: "RECEIVED" };
    const [counts] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM content_reports WHERE reporter_user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 DAY)",
      [userId],
    );
    if (Number(counts[0].total) >= Number(policy.reportsPerDay))
      throw new ErrorResponse("Daily report limit reached", 429);
    const [r] = await db.query<ResultSetHeader>(
      "INSERT INTO content_reports(reporter_user_id,kind,resource_id,reason) VALUES (?,?,?,?)",
      [userId, kind, id, reason],
    );
    return { id: r.insertId, status: "RECEIVED" };
  });
}
export async function listReports(query: Record<string, unknown>) {
  const status = query.status ?? "OPEN";
  if (!["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(String(status)))
    throw new BadRequestError("Invalid report status");
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,kind,resource_id AS resourceId,reason,status,resolution,version,UNIX_TIMESTAMP(created_at) AS createdEpoch FROM content_reports WHERE status=? AND id<? ORDER BY id DESC LIMIT 51",
    [status, cursor(query.cursor)],
  );
  return {
    items: rows.slice(0, 50),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
  };
}
export async function reviewReport(
  userId: number,
  idValue: unknown,
  body: Record<string, unknown>,
) {
  const id = positiveId(idValue, "report"),
    version = positiveId(body.version, "version"),
    reason = boundedText(body.reason, "Review reason", 2000),
    status = body.status;
  if (!["REVIEWING", "RESOLVED", "DISMISSED"].includes(String(status)))
    throw new BadRequestError("Invalid review status");
  return withTransaction(async (db) => {
    await admin(db, userId);
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM content_reports WHERE id=? FOR UPDATE",
      [id],
    );
    const before = rows[0];
    if (!before) throw new NotFoundError("Report unavailable");
    if (Number(before.version) !== version)
      throw new ConflictRequestError("Report changed. Reload before saving.");
    if (["RESOLVED", "DISMISSED"].includes(before.status))
      throw new ConflictRequestError("This report is already closed");
    await db.query(
      "UPDATE content_reports SET status=?,resolution=?,reviewed_by=?,version=version+1 WHERE id=?",
      [status, reason, userId, id],
    );
    await audit(db, userId, "REPORT_REVIEWED", `report:${id}`, {
      before: before.status,
      after: status,
      reason,
    });
    return { id, status, version: version + 1 };
  });
}
export async function auditHistory(value?: unknown) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id,action,target,details_json AS details,UNIX_TIMESTAMP(created_at) AS createdEpoch FROM admin_audit_logs WHERE id<? ORDER BY id DESC LIMIT 51",
    [cursor(value)],
  );
  return {
    items: rows.slice(0, 50),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
  };
}
