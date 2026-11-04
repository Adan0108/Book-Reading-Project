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
  integerRange,
  booleanValue,
} from "../domain/validation";
import * as repository from "../models/repositories/membership.repo";
import { activeMembershipSql } from "../models/repositories/membershipAccess.sql";

type Database = Pick<PoolConnection, "query">;
export interface MembershipPolicy {
  currency: "USD";
  tierOneName: string;
  tierTwoName: string;
  tierOneCents: number;
  tierTwoCents: number;
  tierTwoEnabled: boolean;
  revenueShareBps: number;
  version: number;
}
export async function getMembershipPolicy(
  db: Database = pool,
): Promise<MembershipPolicy> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM platform_membership_policy WHERE id=1",
  );
  const row = rows[0];
  if (!row) throw new NotFoundError("Membership pricing is not configured");
  if (row.currency !== "USD")
    throw new ErrorResponse(
      "Membership pricing is unavailable for this currency",
      503,
    );
  return {
    currency: "USD",
    tierOneName: row.tier_one_name,
    tierTwoName: row.tier_two_name,
    tierOneCents: Number(row.tier_one_cents),
    tierTwoCents: Number(row.tier_two_cents),
    tierTwoEnabled: Boolean(row.tier_two_enabled),
    revenueShareBps: Number(row.revenue_share_bps),
    version: Number(row.version),
  };
}
export async function updateMembershipPolicy(
  adminUserId: number,
  body: Record<string, unknown>,
) {
  if (!(await repository.isActiveAdmin(adminUserId)))
    throw new ForbiddenError("Administrator access required");
  if (body.currency !== undefined && body.currency !== "USD")
    throw new BadRequestError("The MVP currently supports USD pricing only");
  const tierOneName = boundedText(body.tierOneName, "First tier name", 80),
    tierTwoName = boundedText(body.tierTwoName, "Second tier name", 80);
  const tierOneCents = integerRange(
      body.tierOneCents,
      "First tier cents",
      100,
      1000000,
    ),
    tierTwoCents = integerRange(
      body.tierTwoCents,
      "Second tier cents",
      100,
      1000000,
    );
  if (tierTwoCents < tierOneCents)
    throw new BadRequestError(
      "The second tier price must be at least the first tier price",
    );
  const tierTwoEnabled = booleanValue(
      body.tierTwoEnabled,
      "Second tier enabled",
    ),
    revenueShareBps = integerRange(
      body.revenueShareBps,
      "Platform share basis points",
      0,
      10000,
    );
  const expectedVersion = positiveId(body.version, "policy version");
  return withTransaction(async (db) => {
    await db.query(
      "SELECT id FROM platform_membership_policy WHERE id=1 FOR UPDATE",
    );
    const before = await getMembershipPolicy(db);
    if (before.version !== expectedVersion)
      throw new ConflictRequestError("Pricing changed. Reload before saving.");
    await db.query(
      "UPDATE platform_membership_policy SET tier_one_name=?,tier_two_name=?,tier_one_cents=?,tier_two_cents=?,tier_two_enabled=?,revenue_share_bps=?,version=version+1 WHERE id=1",
      [
        tierOneName,
        tierTwoName,
        tierOneCents,
        tierTwoCents,
        Number(tierTwoEnabled),
        revenueShareBps,
      ],
    );
    const after = await getMembershipPolicy(db);
    await db.query(
      "INSERT INTO admin_audit_logs(admin_user_id,action,target,details_json) VALUES (?,'MEMBERSHIP_POLICY_UPDATED','membership-policy',?)",
      [adminUserId, JSON.stringify({ before, after })],
    );
    return after;
  });
}
export async function ownedAuthor(
  userId: number,
  db: Database = pool,
  lock = false,
) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id,user_id,pen_name FROM authors WHERE user_id=? AND is_approved=1 ${lock ? "FOR UPDATE" : ""}`,
    [userId],
  );
  if (!rows[0])
    throw new ForbiddenError("An approved author account is required");
  return rows[0];
}
function benefits(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 12)
    throw new BadRequestError("Use up to twelve tier benefits");
  return value.map((value) => boundedText(value, "Benefit", 200));
}
export async function listAuthorTiers(
  authorId: number,
  includeUnavailable = false,
  db: Database = pool,
) {
  const policy = await getMembershipPolicy(db);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT t.*,l.level FROM membership_tiers t LEFT JOIN membership_tier_levels l ON l.tier_id=t.id WHERE t.author_id=? ${includeUnavailable ? "" : "AND t.is_active=1"} ORDER BY COALESCE(l.level,99),t.id`,
    [authorId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    authorId: Number(row.author_id),
    level: row.level === null ? null : Number(row.level),
    name: row.name,
    description: row.description ?? "",
    benefits: (() => {
      const value =
        typeof row.benefits_json === "string"
          ? JSON.parse(row.benefits_json)
          : row.benefits_json;
      return Array.isArray(value)
        ? value.filter((v) => typeof v === "string")
        : [];
    })(),
    priceCents:
      row.level === 1
        ? policy.tierOneCents
        : row.level === 2
          ? policy.tierTwoCents
          : Math.round(Number(row.price) * 100),
    currency: row.currency,
    available:
      Boolean(row.is_active) &&
      row.level !== null &&
      (row.level !== 2 || policy.tierTwoEnabled),
    pricingVersion: policy.version,
  }));
}
export async function publicAuthorTiers(value: unknown) {
  const authorId = positiveId(value, "author"),
    author = await repository.findAvailableAuthor(authorId);
  if (!author) throw new NotFoundError("Author unavailable");
  return {
    authorId,
    authorName: author.pen_name ?? "Author",
    tiers: (await listAuthorTiers(authorId)).filter((t) => t.available),
  };
}
export async function myTiers(userId: number) {
  const author = await ownedAuthor(userId);
  return {
    authorId: Number(author.id),
    tiers: await listAuthorTiers(Number(author.id), true),
    policy: await getMembershipPolicy(),
  };
}
export async function saveTier(
  userId: number,
  levelValue: unknown,
  body: Record<string, unknown>,
) {
  const level = positiveId(levelValue, "tier level");
  if (level > 2)
    throw new BadRequestError("An author can offer one or two managed tiers");
  if (
    body.price !== undefined ||
    body.priceCents !== undefined ||
    body.currency !== undefined
  )
    throw new BadRequestError("Tier prices follow the platform policy");
  const name = boundedText(body.name, "Tier name", 80),
    description = boundedText(
      body.description ?? "",
      "Description",
      2000,
      false,
    ),
    items = benefits(body.benefits ?? []),
    available = booleanValue(
      body.available ?? true,
      "Available for new members",
    );
  return withTransaction(async (db) => {
    const author = await ownedAuthor(userId, db, true),
      authorId = Number(author.id),
      policy = await getMembershipPolicy(db);
    if (level === 2 && !policy.tierTwoEnabled && available)
      throw new BadRequestError(
        "The second tier is currently disabled by the platform",
      );
    const [levels] = await db.query<RowDataPacket[]>(
      "SELECT tier_id FROM membership_tier_levels WHERE author_id=? AND level=?",
      [authorId, level],
    );
    let tierId = levels[0]?.tier_id;
    const price =
      (level === 1 ? policy.tierOneCents : policy.tierTwoCents) / 100;
    if (!tierId && body.existingTierId !== undefined) {
      const existingId = positiveId(body.existingTierId, "existing tier");
      const [owned] = await db.query<RowDataPacket[]>(
        "SELECT id FROM membership_tiers WHERE id=? AND author_id=?",
        [existingId, authorId],
      );
      if (!owned.length)
        throw new ForbiddenError("Tier belongs to another author");
      const [assigned] = await db.query<RowDataPacket[]>(
        "SELECT level FROM membership_tier_levels WHERE tier_id=?",
        [existingId],
      );
      if (assigned.length)
        throw new ConflictRequestError("This tier already has a managed level");
      tierId = existingId;
    }
    if (!tierId) {
      const [result] = await db.query<ResultSetHeader>(
        "INSERT INTO membership_tiers(author_id,name,description,price,currency,benefits_json,is_active) VALUES (?,?,?,?,'USD',?,?)",
        [
          authorId,
          name,
          description,
          price,
          JSON.stringify(items),
          Number(available),
        ],
      );
      tierId = result.insertId;
    } else
      await db.query(
        "UPDATE membership_tiers SET name=?,description=?,price=?,currency='USD',benefits_json=?,is_active=? WHERE id=? AND author_id=?",
        [
          name,
          description,
          price,
          JSON.stringify(items),
          Number(available),
          tierId,
          authorId,
        ],
      );
    if (!levels.length)
      await db.query(
        "INSERT INTO membership_tier_levels(tier_id,author_id,level) VALUES (?,?,?)",
        [tierId, authorId, level],
      );
    return {
      authorId,
      tier: (await listAuthorTiers(authorId, true, db)).find(
        (t) => t.id === Number(tierId),
      ),
    };
  }).catch((error: { code?: string }) => {
    if (error.code === "ER_DUP_ENTRY")
      throw new ConflictRequestError(
        "Choose a tier name unique to this author",
      );
    throw error;
  });
}
export async function myMembers(userId: number, cursorValue?: unknown) {
  const author = await ownedAuthor(userId),
    cursor =
      cursorValue === undefined
        ? Number.MAX_SAFE_INTEGER
        : positiveId(cursorValue, "cursor");
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT m.id,m.user_id AS userId,p.username,t.name AS tierName,m.status,m.auto_renew AS autoRenew,UNIX_TIMESTAMP(m.current_period_end) AS endEpoch,
    (${activeMembershipSql} AND u.state=1) AS hasAccess
    FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN user_profiles p ON p.user_id=u.id JOIN membership_tiers t ON t.id=m.tier_id
    WHERE m.author_id=? AND m.id<? ORDER BY m.id DESC LIMIT 51`,
    [author.id, cursor],
  );
  const [counts] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,SUM(${activeMembershipSql} AND u.state=1) AS active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.author_id=?`,
    [author.id],
  );
  return {
    items: items.slice(0, 50).map((row) => ({
      ...row,
      currentPeriodEnd: new Date(Number(row.endEpoch) * 1000).toISOString(),
      hasAccess: Boolean(row.hasAccess),
      autoRenew: Boolean(row.autoRenew),
    })),
    nextCursor: items.length > 50 ? Number(items[49].id) : null,
    total: Number(counts[0].total),
    active: Number(counts[0].active ?? 0),
  };
}
export async function myMemberships(userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id,m.author_id AS authorId,a.pen_name AS authorName,t.name AS tierName,m.status,m.auto_renew AS autoRenew,m.provider,
    UNIX_TIMESTAMP(m.current_period_end) AS endEpoch,(${activeMembershipSql} AND a.is_approved=1 AND au.state=1) AS hasAccess
    FROM memberships m JOIN authors a ON a.id=m.author_id JOIN users au ON au.id=a.user_id JOIN membership_tiers t ON t.id=m.tier_id WHERE m.user_id=? ORDER BY m.id DESC LIMIT 100`,
    [userId],
  );
  return {
    items: rows.map((row) => ({
      ...row,
      currentPeriodEnd: new Date(Number(row.endEpoch) * 1000).toISOString(),
      autoRenew: Boolean(row.autoRenew),
      hasAccess: Boolean(row.hasAccess),
    })),
  };
}
export async function cancelMembership(userId: number, value: unknown) {
  const id = positiveId(value, "membership");
  return withTransaction(async (db) => {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id,provider,status FROM memberships WHERE id=? AND user_id=? FOR UPDATE",
      [id, userId],
    );
    if (!rows[0]) throw new NotFoundError("Membership unavailable");
    if (rows[0].provider !== "MANUAL")
      throw new ErrorResponse(
        "Billing management is temporarily unavailable. Please try again later.",
        503,
      );
    await db.query("UPDATE memberships SET auto_renew=0 WHERE id=?", [id]);
    return { id, autoRenew: false, status: rows[0].status };
  });
}
