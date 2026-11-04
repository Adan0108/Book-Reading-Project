import {
  AuthFailureError,
  ForbiddenError,
  NotFoundError,
} from "../core/error.response";
import * as membershipRepo from "../models/repositories/membership.repo";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../dbs/init.mysql";

export interface TierRule {
  tierId: number;
  level: number | null;
}
export interface EntitlementContext {
  userId?: number;
  authorId: number;
  authorAvailable: boolean;
  privileged: boolean;
  isAuthor: boolean;
  memberships: { id: number; tierId: number; level: number | null }[];
}
export type Visibility = "PUBLIC" | "MEMBERS" | "TIERS";
export type AccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "LOGIN_REQUIRED"
        | "MEMBERSHIP_REQUIRED"
        | "TIER_REQUIRED"
        | "UNAVAILABLE";
    };
const yes: AccessDecision = { allowed: true };
const unavailable: AccessDecision = { allowed: false, reason: "UNAVAILABLE" };
export async function loadEntitlementContext(
  userId: number | undefined,
  authorId: number,
  db: Pick<PoolConnection, "query"> = pool,
): Promise<EntitlementContext> {
  const author = await membershipRepo.findAvailableAuthor(authorId, db);
  const isAuthor = Boolean(
    author && userId && Number(author.user_id) === userId,
  );
  const privileged = Boolean(
    author &&
      userId &&
      (Number(author.user_id) === userId ||
        (await membershipRepo.isActiveAdmin(userId, db))),
  );
  const memberships =
    userId && author
      ? await membershipRepo.getActiveMemberships(userId, authorId, db)
      : [];
  return {
    userId,
    authorId,
    authorAvailable: Boolean(author),
    privileged,
    isAuthor,
    memberships: memberships.map((membership) => ({
      id: Number(membership.id),
      tierId: Number(membership.tier_id),
      level: membership.level === null ? null : Number(membership.level),
    })),
  };
}
function visibilityAccess(
  context: EntitlementContext,
  visibility: Visibility,
  rules: TierRule[] = [],
): AccessDecision {
  if (visibility === "PUBLIC") return yes;
  if (!context.userId) return { allowed: false, reason: "LOGIN_REQUIRED" };
  if (!context.memberships.length)
    return { allowed: false, reason: "MEMBERSHIP_REQUIRED" };
  if (visibility === "MEMBERS") return yes;
  return context.memberships.some((membership) =>
    rules.some((rule) =>
      membership.level !== null && rule.level !== null
        ? membership.level >= rule.level
        : membership.tierId === rule.tierId,
    ),
  )
    ? yes
    : { allowed: false, reason: "TIER_REQUIRED" };
}
export function canReadChapter(
  context: EntitlementContext,
  book: { visibility: Visibility; rules: TierRule[] },
  chapter: { released: boolean; visibility: Visibility; rules: TierRule[] },
): AccessDecision {
  if (!context.authorAvailable || !chapter.released) return unavailable;
  if (context.privileged) return yes;
  const parent = visibilityAccess(context, book.visibility, book.rules);
  return parent.allowed
    ? visibilityAccess(context, chapter.visibility, chapter.rules)
    : parent;
}
export function canViewPost(
  context: EntitlementContext,
  post: { released: boolean; visibility: Visibility; rules: TierRule[] },
): AccessDecision {
  if (!context.authorAvailable || !post.released) return unavailable;
  return context.privileged
    ? yes
    : visibilityAccess(context, post.visibility, post.rules);
}
export function canJoinAuthorChat(context: EntitlementContext): AccessDecision {
  if (!context.authorAvailable) return unavailable;
  // Moderation privileges do not turn an administrator into a private chat participant.
  return context.isAuthor ? yes : visibilityAccess(context, "MEMBERS");
}
export function assertEntitled(decision: AccessDecision): void {
  if (decision.allowed) return;
  if (decision.reason === "UNAVAILABLE")
    throw new NotFoundError("Content unavailable");
  if (decision.reason === "LOGIN_REQUIRED")
    throw new AuthFailureError(
      "Sign in to access this author’s members-only content",
    );
  throw new ForbiddenError(
    decision.reason === "TIER_REQUIRED"
      ? "This author’s required membership tier is needed"
      : "An active membership with this author is required",
  );
}
