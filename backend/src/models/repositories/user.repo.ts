import { pool } from "../../dbs/init.mysql";
import type { User } from "../../models/user.model";
import type { UserVerification, VerificationType } from "../../models/userVerification.model";

/**
 * Creates a new user with a specific state and temporary password.
 * state 0 = inactive, 1 = active, 2 = verified_pending_password
 */
export async function createInactiveUser(email: string): Promise<User> {
  const [res] = await pool.query(
    "INSERT INTO users (email, password_hash, state) VALUES (?, ?, 0)",
    [email, "---PENDING_SETUP---"] // Temporary placeholder
  );
  const id = (res as any).insertId as number;
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return (rows as any[])[0] as User;
}

/**
 * Finds the latest unverified OTP for a user that has not expired.
 */
export async function findActiveOtpByType(
  userId: number,
  type: VerificationType
): Promise<UserVerification | null> {
  const [rows] = await pool.query(
    `SELECT * FROM user_verifications
     WHERE user_id = ? AND type = ? AND is_verified = 0 AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, type]
  );
  return (rows as any[])[0] ?? null;
}

/**
 * Finds an OTP created after a specific time (for cooldown checks).
 */
// export async function findRecentOtpByType(
//   userId: number,
//   type: VerificationType,
//   sinceDate: Date
// ): Promise<UserVerification | null> {
//   const [rows] = await pool.query(
//     `SELECT * FROM user_verifications
//      WHERE user_id = ? AND type = ? AND created_at > ?
//      ORDER BY created_at DESC
//      LIMIT 1`,
//     [userId, type, sinceDate]
//   );
//   return (rows as any[])[0] ?? null;
// }

/**
 * Checks for a recent OTP and returns the remaining cooldown seconds.
 * RELIES ENTIRELY ON DATABASE TIME to prevent clock skew.
 */
export async function getRemainingCooldown(
  userId: number,
  type: VerificationType,
  cooldownMinutes: number
): Promise<number> {
  const [rows] = await pool.query(
    `
    SELECT
      -- Calculate remaining seconds, ensuring it's not negative
      GREATEST(0, (? * 60) - TIMESTAMPDIFF(SECOND, created_at, NOW())) AS remaining_seconds
    FROM user_verifications
    WHERE
      user_id = ? AND type = ?
      -- Find any OTP created within the cooldown window
      AND created_at > (NOW() - INTERVAL ? MINUTE)
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [cooldownMinutes, userId, type, cooldownMinutes]
  );

  if ((rows as any[]).length === 0) {
    return 0; // No recent OTP, so no cooldown
  }

  // Return the remaining seconds, rounded up
  return Math.ceil((rows as any[])[0].remaining_seconds);
}

/**
 * Updates a user's state.
 */
export async function updateState(userId: number, state: 0 | 1 | 2): Promise<void> {
  await pool.query("UPDATE users SET state = ?, updated_at = NOW() WHERE id = ?", [state, userId]);
}

/**
 * Updates a user's password.
 */
export async function updatePassword(userId: number, newPasswordHash: string): Promise<void> {
  await pool.query("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [
    newPasswordHash,
    userId,
  ]);
}

/**
 * Invalidates all active OTPs for a user (e.g., when resending).
 */
export async function invalidateActiveOtps(userId: number, type: VerificationType): Promise<void> {
  await pool.query(
    `UPDATE user_verifications
     SET is_verified = 1, updated_at = NOW()
     WHERE user_id = ? AND type = ? AND is_verified = 0`,
    [userId, type]
  );
}

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
