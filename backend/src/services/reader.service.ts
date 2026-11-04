import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../dbs/init.mysql";
import { withTransaction } from "../dbs/transaction";
import {
  BadRequestError,
  ConflictRequestError,
  NotFoundError,
} from "../core/error.response";
import {
  positiveId,
  boundedText,
  booleanValue,
  integerRange,
} from "../domain/validation";
import { decodeTimeCursor, encodeTimeCursor } from "../domain/pagination";
import {
  publicBookSql,
  releasedChapterSql,
} from "../models/repositories/publicationVisibility.sql";
import { activeMembershipSql } from "../models/repositories/membershipAccess.sql";
import {
  findAvailableAuthor,
  getTierRules,
} from "../models/repositories/membership.repo";
import { ownedAuthor } from "./membership.service";
import {
  assertEntitled,
  canReadChapter,
  loadEntitlementContext,
  type Visibility,
} from "./entitlement.service";

function cursor(value: unknown) {
  return value === undefined
    ? Number.MAX_SAFE_INTEGER
    : positiveId(value, "cursor");
}
export async function discoveryFilters() {
  const [genres] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT b.genre FROM books b WHERE ${publicBookSql("b")} ORDER BY b.genre LIMIT 100`,
  );
  const [tags] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT t.slug,t.name FROM tags t JOIN book_tags bt ON bt.tag_id=t.id JOIN books b ON b.id=bt.book_id WHERE ${publicBookSql("b")} ORDER BY t.name,t.slug LIMIT 100`,
  );
  return { genres: genres.map((g) => g.genre), tags };
}
export async function publicAuthor(value: unknown, viewerId?: number) {
  const authorId = positiveId(value, "author"),
    author = await findAvailableAuthor(authorId);
  if (!author) throw new NotFoundError("Author unavailable");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id,a.pen_name AS penName,COALESCE(d.public_bio,'') AS bio,
    (SELECT COUNT(*) FROM author_follows f JOIN users u ON u.id=f.user_id WHERE f.author_id=a.id AND u.state=1) AS followerCount,
    (SELECT COUNT(*) FROM books b WHERE b.author_id=a.id AND ${publicBookSql("b")}) AS bookCount,
    EXISTS(SELECT 1 FROM author_follows f WHERE f.author_id=a.id AND f.user_id=?) AS isFollowing
    FROM authors a LEFT JOIN author_profile_details d ON d.author_id=a.id WHERE a.id=?`,
    [viewerId ?? 0, authorId],
  );
  const row = rows[0];
  return {
    id: authorId,
    penName: row.penName || "Author",
    bio: row.bio,
    followerCount: Number(row.followerCount),
    bookCount: Number(row.bookCount),
    isFollowing: Boolean(row.isFollowing),
    isOwner: Number(author.user_id) === viewerId,
  };
}
export async function authorProfile(userId: number) {
  const a = await ownedAuthor(userId);
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT public_bio FROM author_profile_details WHERE author_id=?",
    [a.id],
  );
  return {
    id: Number(a.id),
    penName: a.pen_name ?? "",
    bio: rows[0]?.public_bio ?? "",
  };
}
export async function saveAuthorProfile(
  userId: number,
  body: Record<string, unknown>,
) {
  return withTransaction(async (db) => {
    const a = await ownedAuthor(userId, db, true);
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT public_bio FROM author_profile_details WHERE author_id=?",
      [a.id],
    );
    const penName = boundedText(
        body.penName === undefined ? a.pen_name : body.penName,
        "Pen name",
        255,
      ),
      bio = boundedText(
        body.bio === undefined ? (existing[0]?.public_bio ?? "") : body.bio,
        "Public biography",
        5000,
        false,
      );
    await db.query("UPDATE authors SET pen_name=? WHERE id=?", [penName, a.id]);
    await db.query(
      "INSERT INTO author_profile_details(author_id,public_bio) VALUES (?,?) ON DUPLICATE KEY UPDATE public_bio=VALUES(public_bio)",
      [a.id, bio],
    );
    return { id: Number(a.id), penName, bio };
  });
}
export async function accountProfile(userId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT u.id,u.email,p.username,p.nickname,p.bio_description AS bio,p.is_private AS isPrivate FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=? AND u.state=1",
    [userId],
  );
  if (!rows[0]) throw new NotFoundError("Account unavailable");
  return {
    id: Number(rows[0].id),
    email: String(rows[0].email),
    username: rows[0].username ?? "",
    nickname: rows[0].nickname ?? "",
    bio: rows[0].bio ?? "",
    isPrivate: Boolean(rows[0].isPrivate),
  };
}
export async function saveAccountProfile(
  userId: number,
  body: Record<string, unknown>,
) {
  await withTransaction(async (db) => {
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id=? AND state=1 FOR UPDATE",
      [userId],
    );
    if (!users.length) throw new NotFoundError("Account unavailable");
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT user_id,username,nickname,bio_description,is_private FROM user_profiles WHERE user_id=? FOR UPDATE",
      [userId],
    );
    const old = existing[0],
      username = boundedText(
        body.username === undefined ? old?.username : body.username,
        "Username",
        50,
      ),
      nickname = boundedText(
        body.nickname === undefined ? (old?.nickname ?? "") : body.nickname,
        "Display name",
        100,
        false,
      ),
      bio = boundedText(
        body.bio === undefined ? (old?.bio_description ?? "") : body.bio,
        "Account biography",
        5000,
        false,
      ),
      isPrivate =
        body.isPrivate === undefined
          ? Boolean(old?.is_private)
          : booleanValue(body.isPrivate, "Private account");
    if (existing[0])
      await db.query(
        "UPDATE user_profiles SET username=?,nickname=?,bio_description=?,is_private=? WHERE user_id=?",
        [username, nickname, bio, Number(isPrivate), userId],
      );
    else
      await db.query(
        "INSERT INTO user_profiles(user_id,username,nickname,bio_description,is_private) VALUES (?,?,?,?,?)",
        [userId, username, nickname, bio, Number(isPrivate)],
      );
  }).catch((error: { code?: string }) => {
    if (error.code === "ER_DUP_ENTRY")
      throw new ConflictRequestError("Choose another username");
    throw error;
  });
  return accountProfile(userId);
}
export async function setFollowing(
  userId: number,
  value: unknown,
  body: Record<string, unknown>,
) {
  const authorId = positiveId(value, "author"),
    followed = booleanValue(body.followed, "Following");
  if (followed) {
    const a = await findAvailableAuthor(authorId);
    if (!a || Number(a.user_id) === userId)
      throw new BadRequestError("Choose another available author");
    await pool.query(
      "INSERT IGNORE INTO author_follows(user_id,author_id) VALUES (?,?)",
      [userId, authorId],
    );
  } else
    await pool.query(
      "DELETE FROM author_follows WHERE user_id=? AND author_id=?",
      [userId, authorId],
    );
  return { authorId, followed };
}
export async function setBookmark(
  userId: number,
  value: unknown,
  body: Record<string, unknown>,
) {
  const bookId = positiveId(value, "book"),
    bookmarked = booleanValue(body.bookmarked, "Bookmarked");
  if (bookmarked) {
    const [books] = await pool.query<RowDataPacket[]>(
      `SELECT b.id FROM books b WHERE b.id=? AND ${publicBookSql("b")}`,
      [bookId],
    );
    if (!books[0]) throw new NotFoundError("Story unavailable");
    await pool.query(
      "INSERT IGNORE INTO book_bookmarks(user_id,book_id) VALUES (?,?)",
      [userId, bookId],
    );
  } else
    await pool.query(
      "DELETE FROM book_bookmarks WHERE user_id=? AND book_id=?",
      [userId, bookId],
    );
  return { bookId, bookmarked };
}
export async function bookLibraryState(userId: number, value: unknown) {
  const bookId = positiveId(value, "book");
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM book_bookmarks WHERE user_id=? AND book_id=?",
    [userId, bookId],
  );
  const [history] = await pool.query<RowDataPacket[]>(
    `SELECT h.chapter_id AS chapterId,c.chapter_no AS chapterNo,h.progress_pct AS progress FROM reading_history h JOIN chapters c ON c.id=h.chapter_id WHERE h.user_id=? AND c.book_id=? AND ${releasedChapterSql("c")} ORDER BY h.last_read_at DESC,h.id DESC LIMIT 1`,
    [userId, bookId],
  );
  return { bookId, bookmarked: rows.length > 0, lastRead: history[0] ?? null };
}
export async function recordReading(
  userId: number,
  body: Record<string, unknown>,
) {
  const chapterId = positiveId(body.chapterId, "chapter"),
    progress = integerRange(body.progress, "Reading progress", 0, 100);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id,c.author_id,c.book_id,c.visibility,b.visibility AS bookVisibility FROM chapters c JOIN books b ON b.id=c.book_id WHERE c.id=? AND ${releasedChapterSql("c")} AND ${publicBookSql("b")}`,
    [chapterId],
  );
  const c = rows[0];
  if (!c) throw new NotFoundError("Chapter unavailable");
  const [context, bookRules, chapterRules] = await Promise.all([
    loadEntitlementContext(userId, Number(c.author_id)),
    getTierRules("book", Number(c.book_id), Number(c.author_id)),
    getTierRules("chapter", chapterId, Number(c.author_id)),
  ]);
  assertEntitled(
    canReadChapter(
      context,
      { visibility: c.bookVisibility as Visibility, rules: bookRules },
      {
        released: true,
        visibility: c.visibility as Visibility,
        rules: chapterRules,
      },
    ),
  );
  await pool.query(
    "INSERT INTO reading_history(user_id,chapter_id,progress_pct) VALUES (?,?,?) ON DUPLICATE KEY UPDATE progress_pct=VALUES(progress_pct),last_read_at=CURRENT_TIMESTAMP(6)",
    [userId, chapterId, progress],
  );
  return { chapterId, progress };
}
function story(row: RowDataPacket) {
  const available = Boolean(row.available);
  return {
    id: Number(row.id),
    bookId: Number(row.book_id),
    title: available ? row.title : "Unavailable story",
    slug: available ? row.slug : null,
    coverUrl: available ? row.coverUrl : null,
    authorName: available ? row.authorName : null,
    available,
  };
}
export async function bookmarks(userId: number, value?: unknown) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT k.id,b.id AS book_id,b.title,b.slug,b.cover_image_url AS coverUrl,a.pen_name AS authorName,(${publicBookSql("b")}) AS available FROM book_bookmarks k JOIN books b ON b.id=k.book_id JOIN authors a ON a.id=b.author_id WHERE k.user_id=? AND k.id<? ORDER BY k.id DESC LIMIT 51`,
    [userId, cursor(value)],
  );
  return {
    items: rows.slice(0, 50).map(story),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
  };
}
export async function follows(userId: number, value?: unknown) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT f.id,f.author_id,a.pen_name,(a.is_approved=1 AND u.state=1) AS available FROM author_follows f JOIN authors a ON a.id=f.author_id JOIN users u ON u.id=a.user_id WHERE f.user_id=? AND f.id<? ORDER BY f.id DESC LIMIT 51",
    [userId, cursor(value)],
  );
  return {
    items: rows.slice(0, 50).map((r) => ({
      id: Number(r.id),
      authorId: Number(r.author_id),
      available: Boolean(r.available),
      penName: r.available ? r.pen_name : "Unavailable author",
    })),
    nextCursor: rows.length > 50 ? Number(rows[49].id) : null,
  };
}
export async function readingHistory(userId: number, value?: unknown) {
  const before = decodeTimeCursor(value),
    binds: unknown[] = [userId];
  if (before) binds.push(before.at, before.at, before.id);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT h.id,c.id AS chapterId,b.id AS book_id,b.title,b.slug,b.cover_image_url AS coverUrl,a.pen_name AS authorName,(${publicBookSql("b")} AND ${releasedChapterSql("c")}) AS available,c.chapter_no AS chapterNo,h.progress_pct AS progress,DATE_FORMAT(h.last_read_at,'%Y-%m-%d %H:%i:%s.%f') AS cursorTime,UNIX_TIMESTAMP(h.last_read_at) AS readEpoch FROM reading_history h JOIN chapters c ON c.id=h.chapter_id JOIN books b ON b.id=c.book_id JOIN authors a ON a.id=b.author_id WHERE h.user_id=? ${before ? "AND (h.last_read_at<? OR (h.last_read_at=? AND h.id<?))" : ""} ORDER BY h.last_read_at DESC,h.id DESC LIMIT 51`,
    binds,
  );
  return {
    items: rows.slice(0, 50).map((r) => ({
      ...story(r),
      chapterId: Number(r.chapterId),
      chapterNo: r.available ? Number(r.chapterNo) : null,
      progress: Number(r.progress),
      lastReadAt: new Date(Number(r.readEpoch) * 1000).toISOString(),
    })),
    nextCursor:
      rows.length > 50
        ? encodeTimeCursor(rows[49].cursorTime, Number(rows[49].id))
        : null,
  };
}
export async function removeHistory(userId: number, value: unknown) {
  const chapterId = positiveId(value, "chapter");
  await pool.query(
    "DELETE FROM reading_history WHERE user_id=? AND chapter_id=?",
    [userId, chapterId],
  );
  return { chapterId };
}
export async function authorAnalytics(userId: number) {
  const a = await ownedAuthor(userId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
  (SELECT COUNT(*) FROM books b WHERE b.author_id=? AND b.deleted_at IS NULL) AS books,
  (SELECT COALESCE(SUM(views_count),0) FROM books WHERE author_id=?) AS recordedBookViews,
  (SELECT COUNT(*) FROM chapters c JOIN books b ON b.id=c.book_id WHERE b.author_id=? AND ${releasedChapterSql("c")} AND ${publicBookSql("b")}) AS releasedChapters,
  (SELECT COUNT(*) FROM author_follows f JOIN users u ON u.id=f.user_id WHERE f.author_id=? AND u.state=1) AS followers,
  (SELECT COUNT(*) FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.author_id=? AND ${activeMembershipSql} AND u.state=1) AS eligibleMemberships`,
    [a.id, a.id, a.id, a.id, a.id],
  );
  return Object.fromEntries(
    Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]),
  );
}
