import { pool } from '../../dbs/init.mysql';

export const findAuthorByUserId = async (userId: number) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, pen_name, is_approved
     FROM authors
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );
  const r = (rows as any[])[0];
  return r || null;
};
