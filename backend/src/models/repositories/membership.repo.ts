import { pool } from '../../dbs/init.mysql';

export const getActiveMembership = async (userId: number, authorId: number) => {
  const [rows] = await pool.query(
    `SELECT id, user_id, author_id, tier_id, status, current_period_end
     FROM memberships
     WHERE user_id = ? AND author_id = ?
       AND status = 'ACTIVE'
       AND current_period_end > NOW()
     ORDER BY current_period_end DESC
     LIMIT 1`,
    [userId, authorId],
  );
  return (rows as any[])[0] || null;
};

export const canAccessBookTier = async (bookId: number, authorId: number, tierId: number) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM book_tier_access
     WHERE book_id = ? AND author_id = ? AND tier_id = ?
     LIMIT 1`,
    [bookId, authorId, tierId],
  );
  return (rows as any[]).length > 0;
};

export const canAccessChapterTier = async (chapterId: number, authorId: number, tierId: number) => {
  const [rows] = await pool.query(
    `SELECT 1 FROM chapter_tier_access
     WHERE chapter_id = ? AND author_id = ? AND tier_id = ?
     LIMIT 1`,
    [chapterId, authorId, tierId],
  );
  return (rows as any[]).length > 0;
};
