import { pool } from "../../dbs/init.mysql";
import type { User } from "../../models/user.model";
import type { VerificationType } from "../../models/userVerification.model";

// ---------- Reads ----------
export async function findById(id: number): Promise<User | null> {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return (rows as any[])[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return (rows as any[])[0] ?? null;
}

export async function getRoles(userId: number): Promise<string[]> {
  const [rows] = await pool.query(
    `SELECT r.code
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  return (rows as any[]).map(r => r.code as string);
}

// ---------- Writes ----------
export async function create(email: string, passwordHash: string): Promise<User> {
  const [res] = await pool.query(
    "INSERT INTO users (email, password_hash, state) VALUES (?,?,1)",
    [email, passwordHash]
  );
  const id = (res as any).insertId as number;
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return (rows as any[])[0] as User;
}

export async function addRole(userId: number, roleCode: string): Promise<void> {
  const [r] = await pool.query("SELECT id FROM roles WHERE code = ? LIMIT 1", [roleCode]);
  const role = (r as any[])[0];
  if (!role) throw new Error(`Role not found: ${roleCode}`);
  await pool.query(
    "INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?,?)",
    [userId, role.id]
  );
}

export async function createVerification(
  userId: number,
  type: VerificationType,
  otpHash: string | null,
  expiresAt: Date
): Promise<void> {
  await pool.query(
    `INSERT INTO user_verifications (user_id, type, otp_hash, is_verified, expires_at)
     VALUES (?,?,?,?,?)`,
    [userId, type, otpHash, 0, expiresAt]
  );
}

export async function markVerificationAsVerified(verificationId: number): Promise<void> {
  await pool.query(
    "UPDATE user_verifications SET is_verified = 1, updated_at = NOW() WHERE id = ?",
    [verificationId]
  );
}

export async function blockUser(userId: number): Promise<void> {
  await pool.query("UPDATE users SET state = 0, updated_at = NOW() WHERE id = ?", [userId]);
}

export async function unblockUser(userId: number): Promise<void> {
  await pool.query("UPDATE users SET state = 1, updated_at = NOW() WHERE id = ?", [userId]);
}
