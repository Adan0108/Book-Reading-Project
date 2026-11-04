import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../dbs/init.mysql";
import { activeMembershipSql } from "./membershipAccess.sql";

export async function findParticipantConversation(
  userId: number,
  id: number,
  db: Pick<PoolConnection, "query"> = pool,
) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT c.*,a.user_id AS author_user_id,a.pen_name,p.username AS member_name
    FROM member_conversations c JOIN authors a ON a.id=c.author_id LEFT JOIN user_profiles p ON p.user_id=c.member_user_id
    WHERE c.id=? AND (c.member_user_id=? OR a.user_id=?)`,
    [id, userId, userId],
  );
  return rows[0];
}
/** One bounded projection: no message bodies and no per-conversation authorization query fan-out. */
export async function listConversationSummaries(
  userId: number,
  cursor: number,
) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id,c.author_id,c.member_user_id,a.user_id AS author_user_id,a.pen_name,p.username AS member_name,
    (a.is_approved=1 AND au.state=1) AS author_available,
    (mu.state=1 AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=c.member_user_id AND m.author_id=c.author_id AND ${activeMembershipSql})) AS member_eligible,
    (SELECT COUNT(*) FROM member_messages msg WHERE msg.conversation_id=c.id AND msg.sender_user_id<>?
      AND msg.id>IF(a.user_id=?,c.author_read_id,c.member_read_id)) AS unread
    FROM member_conversations c JOIN authors a ON a.id=c.author_id JOIN users au ON au.id=a.user_id
    JOIN users mu ON mu.id=c.member_user_id LEFT JOIN user_profiles p ON p.user_id=c.member_user_id
    WHERE (c.member_user_id=? OR a.user_id=?) AND c.id<? ORDER BY c.id DESC LIMIT 51`,
    [userId, userId, userId, userId, cursor],
  );
  return rows;
}
