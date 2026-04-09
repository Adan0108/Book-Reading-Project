import { BadRequestError, ConflictRequestError, NotFoundError, ForbiddenError } from "../core/error.response";
import * as authorAppRepo from "../models/repositories/authorApplication.repo";
import * as userRepo from "../models/repositories/user.repo";
import type { AuthorApplicationStatus } from "../models/authorApplication.model";

function toInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function normalizeStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function parseArray(v: any): string[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  return null;
}

export async function submitApplication(userId: number, body: any, meta: { ip: string; userAgent: string }) {
  // block if already AUTHOR
  const roles = await userRepo.getRoles(userId);
  const upper = (roles || []).map(r => String(r).toUpperCase());
  if (upper.includes("AUTHOR")) throw new ConflictRequestError("You are already an author");

  // block if active application exists
  const active = await authorAppRepo.findActiveByUser(userId);
  if (active) throw new ConflictRequestError("You already have an active author application");

  const applicationTitle = normalizeStr(body?.applicationTitle);
  const sampleTitle = normalizeStr(body?.sampleTitle);
  const sampleStory = normalizeStr(body?.sampleStory);

  if (!applicationTitle || applicationTitle.length < 5) {
    throw new BadRequestError("applicationTitle is required (min 5 chars)");
  }
  if (!sampleTitle || sampleTitle.length < 3) {
    throw new BadRequestError("sampleTitle is required (min 3 chars)");
  }
  if (!sampleStory || sampleStory.length < 800) {
    throw new BadRequestError("sampleStory is required (min 800 chars)");
  }

  const created = await authorAppRepo.createApplication({
    userId,
    penName: normalizeStr(body?.penName) || null,
    applicationTitle,
    sampleTitle,
    sampleStory,
    bio: normalizeStr(body?.bio) || null,
    motivation: normalizeStr(body?.motivation) || null,
    genres: parseArray(body?.genres),
    portfolioLinks: parseArray(body?.portfolioLinks),
    extra: body?.extra ?? null,
    submitIp: meta.ip,
    submitUserAgent: meta.userAgent,
  });

  return {
    id: created.id,
    status: created.status,
    submittedAt: created.submitted_at,
  };
}

export async function getMyLatest(userId: number) {
  const app = await authorAppRepo.findLatestByUser(userId);
  if (!app) throw new NotFoundError("No author application found");

  // user-visible view (hide internal_notes, ai flags, etc.)
  return {
    id: app.id,
    status: app.status,
    penName: app.pen_name,
    applicationTitle: app.application_title,
    sampleTitle: app.sample_title,
    decisionReason: app.decision_reason,
    submittedAt: app.submitted_at,
    reviewedAt: app.reviewed_at,
  };
}

export async function withdraw(userId: number, id: number) {
  const app = await authorAppRepo.findById(id);
  if (!app) throw new NotFoundError("Application not found");
  if (app.user_id !== userId) throw new ForbiddenError("Forbidden");
  if (app.status !== "PENDING" && app.status !== "UNDER_REVIEW") {
    throw new ConflictRequestError("Cannot withdraw a decided application");
  }

  await authorAppRepo.withdrawById(id, userId);
  return { id, status: "WITHDRAWN" };
}
/////////////////////////////////////////////////
// ADMIN  //
/////////////////////////////////////////////////
export async function listApplications(q: any) {
  const status = (q?.status ? String(q.status).toUpperCase() : undefined) as AuthorApplicationStatus | undefined;
  const page = toInt(q?.page, 1);
  const limit = Math.min(toInt(q?.limit, 20), 100);

  const { items, total } = await authorAppRepo.adminList({ status, page, limit });

  // light list view
  return {
    items: items.map((a) => ({
      id: a.id,
      userId: a.user_id,
      applicationTitle: a.application_title,
      sampleTitle: a.sample_title,
      status: a.status,
      submittedAt: a.submitted_at,
      reviewedAt: a.reviewed_at,
      spamScore: a.spam_score,
      qualityScore: a.quality_score,
    })),
    pagination: { page, limit, total },
  };
}

export async function getDetail(id: number) {
  const app = await authorAppRepo.findById(id);
  if (!app) throw new NotFoundError("Application not found");
  return app;
}

export async function markUnderReview(id: number, adminUserId: number) {
  const app = await authorAppRepo.findById(id);
  if (!app) throw new NotFoundError("Application not found");
  if (app.status !== "PENDING") throw new ConflictRequestError("Only PENDING applications can be marked UNDER_REVIEW");

  await authorAppRepo.markUnderReview(id, adminUserId);
  return { id, status: "UNDER_REVIEW" };
}

export async function approve(id: number, adminUserId: number, body: any) {
  const app = await authorAppRepo.findById(id);
  if (!app) throw new NotFoundError("Application not found");
  if (app.status !== "PENDING" && app.status !== "UNDER_REVIEW") {
    throw new ConflictRequestError("Application already decided");
  }

  // upgrade user to AUTHOR
  await userRepo.addRole(app.user_id, "AUTHOR");

  await authorAppRepo.decideApplication({
    id,
    adminUserId,
    status: "APPROVED",
    decisionReason: body?.decisionReason ?? null,
    internalNotes: body?.internalNotes ?? null,
  });

  return { id, status: "APPROVED", userId: app.user_id };
}

export async function reject(id: number, adminUserId: number, body: any) {
  const app = await authorAppRepo.findById(id);
  if (!app) throw new NotFoundError("Application not found");
  if (app.status !== "PENDING" && app.status !== "UNDER_REVIEW") {
    throw new ConflictRequestError("Application already decided");
  }

  const decisionReason = body?.decisionReason;
  if (!decisionReason || String(decisionReason).trim().length < 3) {
    throw new BadRequestError("decisionReason is required");
  }

  await authorAppRepo.decideApplication({
    id,
    adminUserId,
    status: "REJECTED",
    decisionReason,
    internalNotes: body?.internalNotes ?? null,
  });

  return { id, status: "REJECTED", userId: app.user_id };
}