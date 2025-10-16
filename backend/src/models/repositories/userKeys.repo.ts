import { pool } from "../../dbs/init.mysql";

export interface UserKeysRow {
  user_id: number;
  public_key: string;
  private_key: string;
  created_at: Date;
  updated_at: Date;
}

export async function getByUserId(userId: number): Promise<UserKeysRow> {
  const [rows] = await pool.query("SELECT * FROM user_keys WHERE user_id = ? LIMIT 1", [userId]);
  return (rows as any[])[0] ?? null;
}

export async function upsert(userId: number, publicKey: string, privateKey: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_keys (user_id, public_key, private_key)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE public_key = VALUES(public_key), private_key = VALUES(private_key), updated_at = NOW()`,
    [userId, publicKey, privateKey]
  );
}
