import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import type {
  ResultSetHeader,
  RowDataPacket,
  PoolConnection,
} from "mysql2/promise";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
import {
  BadRequestError,
  ConflictRequestError,
  ErrorResponse,
  NotFoundError,
} from "../core/error.response";
import { boundedText, positiveId } from "../domain/validation";
import {
  assertEntitled,
  canJoinAuthorChat,
  loadEntitlementContext,
} from "../services/entitlement.service";
import { findAvailableAuthor } from "../models/repositories/membership.repo";
import {
  findParticipantConversation,
  listConversationSummaries,
} from "../models/repositories/chat.repo";

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  text: string;
  createdAt: string;
  clientId: string;
}
// Local delivery hints only. MySQL history is the recovery source; events are never financial authority.
export const chatEvents = new EventEmitter();
export async function conversationParticipants(id: number): Promise<number[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT c.member_user_id,a.user_id FROM member_conversations c JOIN authors a ON a.id=c.author_id WHERE c.id=?",
    [id],
  );
  return rows[0]
    ? [Number(rows[0].member_user_id), Number(rows[0].user_id)]
    : [];
}
function message(row: RowDataPacket): ChatMessage {
  return {
    id: Number(row.id),
    conversationId: Number(row.conversation_id),
    senderId: Number(row.sender_user_id),
    text: row.body,
    clientId: row.client_id,
    createdAt: new Date(Number(row.createdEpoch) * 1000).toISOString(),
  };
}
export async function conversationAccess(
  userId: number,
  idValue: unknown,
  write = false,
  db: Pick<PoolConnection, "query"> = pool,
) {
  const id = positiveId(idValue, "conversation");
  const row = await findParticipantConversation(userId, id, db);
  if (!row) throw new NotFoundError("Conversation unavailable");
  const context = await loadEntitlementContext(
    Number(row.member_user_id),
    Number(row.author_id),
    db,
  );
  if (!context.authorAvailable) throw new NotFoundError("Author unavailable");
  const permission = canJoinAuthorChat(context),
    isAuthor = Number(row.author_user_id) === userId;
  if (!isAuthor || write) assertEntitled(permission);
  return { row, isAuthor, canSend: permission.allowed };
}
export async function createConversation(
  userId: number,
  body: Record<string, unknown>,
) {
  const authorId = positiveId(body.authorId, "author"),
    author = await findAvailableAuthor(authorId);
  if (!author) throw new NotFoundError("Author unavailable");
  const isAuthor = Number(author.user_id) === userId;
  const memberId = isAuthor ? positiveId(body.memberId, "member") : userId;
  if (
    memberId === Number(author.user_id) ||
    (!isAuthor &&
      body.memberId !== undefined &&
      positiveId(body.memberId) !== userId)
  )
    throw new BadRequestError("Choose an eligible member conversation");
  const id = await withTransaction(async (db) => {
    // Both participants acquire the same parent first; separate user locks can deadlock on FK checks.
    await db.query("SELECT id FROM authors WHERE id=? FOR UPDATE", [authorId]);
    assertEntitled(
      canJoinAuthorChat(await loadEntitlementContext(memberId, authorId, db)),
    );
    const [r] = await db.query<ResultSetHeader>(
      "INSERT INTO member_conversations(author_id,member_user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)",
      [authorId, memberId],
    );
    return r.insertId;
  });
  return { id, authorId, memberId };
}
export async function listConversations(userId: number, cursorValue?: unknown) {
  const cursor =
    cursorValue === undefined
      ? Number.MAX_SAFE_INTEGER
      : positiveId(cursorValue, "cursor");
  const rows = await listConversationSummaries(userId, cursor);
  const items = rows.slice(0, 50).map((row) => {
    const available = Boolean(row.author_available),
      eligible = available && Boolean(row.member_eligible),
      isAuthor = Number(row.author_user_id) === userId;
    return {
      id: Number(row.id),
      authorId: Number(row.author_id),
      memberId: Number(row.member_user_id),
      title: isAuthor ? row.member_name || "Member" : row.pen_name || "Author",
      canRead: available && (isAuthor || eligible),
      canSend: eligible,
      unread: available && (isAuthor || eligible) ? Number(row.unread) : 0,
    };
  });
  return { items, nextCursor: rows.length > 50 ? Number(rows[49].id) : null };
}
export async function messageHistory(
  userId: number,
  id: unknown,
  cursorValue?: unknown,
) {
  const access = await conversationAccess(userId, id),
    cursor =
      cursorValue === undefined
        ? Number.MAX_SAFE_INTEGER
        : positiveId(cursorValue, "cursor");
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT *,UNIX_TIMESTAMP(created_at) AS createdEpoch FROM member_messages WHERE conversation_id=? AND id<? ORDER BY id DESC LIMIT 51",
    [access.row.id, cursor],
  );
  return {
    items: rows.slice(0, 50).reverse().map(message),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
    canSend: access.canSend,
    peerLastReadId: Number(
      access.isAuthor ? access.row.member_read_id : access.row.author_read_id,
    ),
  };
}
export async function sendMessage(
  userId: number,
  idValue: unknown,
  body: Record<string, unknown>,
) {
  const id = positiveId(idValue, "conversation"),
    text = boundedText(body.text, "Message", 4000),
    clientId = body.clientId;
  if (
    typeof clientId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientId,
    )
  )
    throw new BadRequestError("A stable UUID v4 message ID is required");
  const hash = createHash("sha256")
    .update(JSON.stringify([id, text]))
    .digest("hex");
  const saved = await withTransaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=? FOR UPDATE", [userId]);
    await db.query(
      "SELECT id FROM member_conversations WHERE id=? FOR UPDATE",
      [id],
    );
    await conversationAccess(userId, id, true, db);
    const [replay] = await db.query<RowDataPacket[]>(
      "SELECT *,UNIX_TIMESTAMP(created_at) AS createdEpoch FROM member_messages WHERE sender_user_id=? AND client_id=?",
      [userId, clientId],
    );
    if (replay[0]) {
      if (replay[0].payload_hash !== hash)
        throw new ConflictRequestError(
          "Message ID reused with different content",
        );
      return message(replay[0]);
    }
    const [quota] = await db.query<RowDataPacket[]>(
      "SELECT SUM(created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE)) AS recent,COUNT(*) AS daily FROM member_messages WHERE sender_user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 DAY)",
      [userId],
    );
    if (Number(quota[0].recent) >= 30 || Number(quota[0].daily) >= 1000)
      throw new ErrorResponse("Message limit reached. Try again later.", 429);
    const [r] = await db.query<ResultSetHeader>(
      "INSERT INTO member_messages(conversation_id,sender_user_id,client_id,payload_hash,body) VALUES (?,?,?,?,?)",
      [id, userId, clientId, hash, text],
    );
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT *,UNIX_TIMESTAMP(created_at) AS createdEpoch FROM member_messages WHERE id=?",
      [r.insertId],
    );
    return message(rows[0]);
  });
  chatEvents.emit("message", saved);
  return saved;
}
export async function markRead(
  userId: number,
  idValue: unknown,
  body: Record<string, unknown>,
) {
  const access = await conversationAccess(userId, idValue),
    messageId = positiveId(body.messageId, "message");
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM member_messages WHERE conversation_id=? AND id=?",
    [access.row.id, messageId],
  );
  if (!rows[0]) throw new NotFoundError("Message unavailable");
  const column = access.isAuthor ? "author_read_id" : "member_read_id";
  await pool.query(
    `UPDATE member_conversations SET ${column}=GREATEST(${column},?) WHERE id=?`,
    [messageId, access.row.id],
  );
  chatEvents.emit("changed", { conversationId: Number(access.row.id) });
  return { conversationId: Number(access.row.id), lastReadId: messageId };
}
