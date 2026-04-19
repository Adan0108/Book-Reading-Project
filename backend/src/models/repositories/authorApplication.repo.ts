import { pool } from "../../dbs/init.mysql";
import type { AuthorApplication, AuthorApplicationStatus } from "../authorApplication.model";

const ACTIVE_STATUSES: AuthorApplicationStatus[] = ["PENDING", "UNDER_REVIEW"];

export async function findById(id: number): Promise<AuthorApplication | null> {
  const [rows] = await pool.query("SELECT * FROM author_applications WHERE id = ? LIMIT 1", [id]);
  return (rows as any[])[0] ?? null;
}

export async function findLatestByUser(userId: number): Promise<AuthorApplication | null> {
  const [rows] = await pool.query(
    "SELECT * FROM author_applications WHERE user_id = ? ORDER BY submitted_at DESC, id DESC LIMIT 1",
    [userId]
  );
  return (rows as any[])[0] ?? null;
}

export async function findActiveByUser(userId: number): Promise<AuthorApplication | null> {
  const [rows] = await pool.query(
    `SELECT * FROM author_applications
     WHERE user_id = ? AND status IN (?, ?)
     ORDER BY submitted_at DESC, id DESC
     LIMIT 1`,
    [userId, ACTIVE_STATUSES[0], ACTIVE_STATUSES[1]]
  );
  return (rows as any[])[0] ?? null;
}

export async function createApplication(input: {
  userId: number;
  penName?: string | null;
  applicationTitle: string;
  sampleTitle: string;
  sampleStory: string;
  bio?: string | null;
  motivation?: string | null;
  genres?: string[] | null;
  portfolioLinks?: string[] | null;
  extra?: any | null;
  submitIp?: string | null;
  submitUserAgent?: string | null;
}): Promise<AuthorApplication> {
  const genresJson = input.genres ? JSON.stringify(input.genres) : null;
  const linksJson = input.portfolioLinks ? JSON.stringify(input.portfolioLinks) : null;
  const extraJson = input.extra ? JSON.stringify(input.extra) : null;

  const [res] = await pool.query(
    `INSERT INTO author_applications
     (user_id, pen_name, application_title, sample_title, sample_story, bio, motivation,
      genres_json, portfolio_links_json, extra_json, submit_ip, submit_user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.userId,
      input.penName ?? null,
      input.applicationTitle,
      input.sampleTitle,
      input.sampleStory,
      input.bio ?? null,
      input.motivation ?? null,
      genresJson,
      linksJson,
      extraJson,
      input.submitIp ?? null,
      input.submitUserAgent ?? null,
    ]
  );

  const id = (res as any).insertId as number;
  const created = await findById(id);
  if (!created) throw new Error("Failed to create author application");
  return created;
}

export async function withdrawById(id: number, userId: number): Promise<void> {
  await pool.query(
    `UPDATE author_applications
     SET status = 'WITHDRAWN', reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
     WHERE id = ? AND user_id = ? AND status IN ('PENDING','UNDER_REVIEW')`,
    [id, userId]
  );
}

export async function markUnderReview(id: number, adminUserId: number): Promise<void> {
  await pool.query(
    `UPDATE author_applications
     SET status = 'UNDER_REVIEW', reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = ? AND status = 'PENDING'`,
    [adminUserId, id]
  );
}

export async function decideApplication(input: {
  id: number;
  adminUserId: number;
  status: "APPROVED" | "REJECTED";
  decisionReason?: string | null;
  internalNotes?: string | null;
}): Promise<void> {
  await pool.query(
    `UPDATE author_applications
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(),
         decision_reason = ?, internal_notes = ?, updated_at = NOW()
     WHERE id = ? AND status IN ('PENDING','UNDER_REVIEW')`,
    [
      input.status,
      input.adminUserId,
      input.decisionReason ?? null,
      input.internalNotes ?? null,
      input.id,
    ]
  );
}

export async function adminList(input: {
  status?: AuthorApplicationStatus;
  page: number;
  limit: number;
}): Promise<{ items: AuthorApplication[]; total: number }> {
  const where: string[] = [];
  const params: any[] = [];

  if (input.status) {
    where.push("status = ?");
    params.push(input.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (input.page - 1) * input.limit;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM author_applications ${whereSql}`,
    params
  );
  const total = Number((countRows as any[])[0]?.total ?? 0);

  const [rows] = await pool.query(
    `SELECT * FROM author_applications
     ${whereSql}
     ORDER BY submitted_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, input.limit, offset]
  );

  return { items: rows as any[], total };
}