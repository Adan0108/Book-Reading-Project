import { pool } from "../../dbs/init.mysql";
import { UserProfile } from "../userProfile.model";

export async function createProfile(userId: number, username: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_profiles (user_id, username, is_private)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE username = VALUES(username), updated_at = NOW()`,
    [userId, username]
  );
}

export async function findByUserId(userId: number): Promise<UserProfile | null> {
  const [rows] = await pool.query(
    "SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1", 
    [userId]
  );
  return (rows as any[])[0] ?? null;
}
