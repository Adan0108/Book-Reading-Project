import { pool } from "../../dbs/init.mysql";

export async function createProfile(userId: number, username: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_profiles (user_id, username, is_private)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE username = VALUES(username), updated_at = NOW()`,
    [userId, username]
  );
}
