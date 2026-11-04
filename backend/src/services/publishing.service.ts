import { randomUUID, createHash } from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../dbs/init.mysql';
import cloudinary from '../configs/cloudinary.config';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictRequestError, ErrorResponse } from '../core/error.response';
import { cacheDel } from '../utils/cache';
import { getRedis } from '../dbs/init.redis';

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 100;
const formats: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateFile(body: any) {
  if (!Object.prototype.hasOwnProperty.call(formats, body.mimeType) || !Number.isInteger(body.size) || body.size < 1 || body.size > MAX_BYTES)
    throw new BadRequestError('Choose a JPEG, PNG or WebP image up to 10 MB.');
  if (!['cover', 'chapter'].includes(body.purpose)) throw new BadRequestError('Invalid upload purpose');
  if (body.purpose === 'chapter' && !Number.isSafeInteger(body.bookId)) throw new BadRequestError('Book is required');
  if (body.bookId !== undefined && (!Number.isSafeInteger(body.bookId) || body.bookId < 1)) throw new BadRequestError('Invalid book');
}
async function rows(db: any, sql: string, args: any[] = []): Promise<any[]> {
  const [result] = await db.query(sql, args); return result;
}
async function author(db: any, userId: number) {
  const [a] = await rows(db, 'SELECT id FROM authors WHERE user_id = ? FOR UPDATE', [userId]);
  if (!a) throw new ForbiddenError('User is not an author');
  return a.id;
}
async function book(db: any, bookId: number, authorId: number) {
  const [b] = await rows(db, 'SELECT * FROM books WHERE id = ? AND author_id = ? AND deleted_at IS NULL FOR UPDATE', [bookId, authorId]);
  if (!b) throw new NotFoundError('Book not found'); return b;
}
async function transaction<T>(run: (db: PoolConnection) => Promise<T>) {
  const db = await pool.getConnection();
  try { await db.beginTransaction(); const result = await run(db); await db.commit(); return result; }
  catch (e) { await db.rollback(); throw e; }
  finally { db.release(); }
}

export async function authorizeUpload(userId: number, body: any) {
  validateFile(body);
  const config = cloudinary.config();
  if (!config.api_secret || !config.cloud_name || !config.api_key || !process.env.CLOUDINARY_PUBLISHING_PRESET)
    throw new ErrorResponse('Image uploads are not configured. Contact the site administrator.', 503);
  const id = randomUUID();
  const publicId = `meomic/publishing/${id}`;
  await transaction(async db => {
    const authorId = await author(db, userId);
    if (body.bookId !== undefined) await book(db, body.bookId, authorId);
    const [quota] = await rows(db, `SELECT COUNT(*) AS total,
      SUM(created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)) AS recent
      FROM publishing_assets WHERE author_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)`, [authorId]);
    if (Number(quota.total) >= 500 || Number(quota.recent) >= 120) throw new ErrorResponse('Upload limit reached. Please try later.', 429);
    await db.query(`INSERT INTO publishing_assets
      (id, author_id, book_id, purpose, public_id, expected_bytes, expected_format, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
    [id, authorId, body.bookId ?? null, body.purpose, publicId, body.size, formats[body.mimeType]]);
  });
  const params = { timestamp: Math.floor(Date.now() / 1000), public_id: publicId, overwrite: false,
    upload_preset: process.env.CLOUDINARY_PUBLISHING_PRESET!, allowed_formats: 'jpg,png,webp' };
  return { id, cloudName: config.cloud_name, apiKey: config.api_key, params,
    signature: cloudinary.utils.api_sign_request(params, config.api_secret) };
}

// The client sends only our opaque intent ID. URLs and public IDs come from Cloudinary's Admin API.
export async function confirmUpload(userId: number, id: string) {
  if (!uuid.test(id)) throw new BadRequestError('Invalid asset ID');
  const [a] = await rows(pool, `SELECT p.*, p.expires_at > NOW() AS is_valid FROM publishing_assets p JOIN authors a ON a.id = p.author_id
    WHERE p.id = ? AND a.user_id = ?`, [id, userId]);
  if (!a) throw new NotFoundError('Upload not found');
  if (a.confirmed_at) return { id: a.id, imageUrl: a.image_url };
  if (!a.is_valid) throw new BadRequestError('Upload authorization expired. Select the image again.');
  const redis = getRedis();
  if (!redis) throw new ErrorResponse('Upload verification is temporarily unavailable.', 503);
  const rateKey = `publishing:confirm:${a.author_id}:${Math.floor(Date.now() / 60000)}`;
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, 120);
  if (attempts > 120) throw new ErrorResponse('Image verification limit reached. Retry in a minute.', 429);
  let resource: any;
  try { resource = await cloudinary.api.resource(a.public_id, { resource_type: 'image', type: 'upload', timeout: 20000 }); }
  catch { throw new ErrorResponse('Could not verify the uploaded image. Retry saving.', 502); }
  if (resource.public_id !== a.public_id || resource.resource_type !== 'image' || resource.type !== 'upload' ||
      resource.format !== a.expected_format || !Number.isSafeInteger(resource.bytes) || resource.bytes < 1 || resource.bytes > MAX_BYTES ||
      !Number.isSafeInteger(resource.width) || !Number.isSafeInteger(resource.height) ||
      !resource.asset_id || !resource.secure_url?.startsWith('https://') || resource.width < 1 || resource.height < 1 ||
      resource.width * resource.height > 100_000_000 || (resource.pages ?? 1) > 1)
    throw new BadRequestError('Uploaded asset does not match the authorized image.');
  await pool.query(`UPDATE publishing_assets SET cloud_asset_id = ?, image_url = ?, confirmed_at = NOW()
    WHERE id = ? AND confirmed_at IS NULL`, [resource.asset_id, resource.secure_url, id]);
  return { id, imageUrl: resource.secure_url };
}

export async function getChapterImages(chapterId: number, db: any = pool) {
  return rows(db, `SELECT a.id, a.image_url AS imageUrl, ci.page_order AS pageOrder FROM chapter_images ci
    JOIN publishing_assets a ON a.id = ci.asset_id WHERE ci.chapter_id = ? ORDER BY ci.page_order`, [chapterId]);
}
export function validateAssetIds(ids: any): asserts ids is string[] {
  if (!Array.isArray(ids) || ids.length > MAX_PAGES || ids.some(id => typeof id !== 'string' || !uuid.test(id)) || new Set(ids).size !== ids.length)
    throw new BadRequestError('Choose up to 100 distinct chapter images.');
}
async function attachable(db: any, id: string, authorId: number, purpose: string, bookId?: number, chapterId?: number) {
  if (typeof id !== 'string' || !uuid.test(id)) throw new BadRequestError('Invalid asset ID');
  const [a] = await rows(db, 'SELECT * FROM publishing_assets WHERE id = ? FOR UPDATE', [id]);
  if (!a || Number(a.author_id) !== Number(authorId) || a.purpose !== purpose || !a.confirmed_at ||
      (a.book_id !== null && Number(a.book_id) !== bookId)) throw new ForbiddenError('Image is not authorized for this work');
  const used = await rows(db, purpose === 'chapter' ? 'SELECT chapter_id AS target FROM chapter_images WHERE asset_id = ?' : 'SELECT book_id AS target FROM book_covers WHERE asset_id = ?', [id]);
  if (used.length && Number(used[0].target) !== (purpose === 'chapter' ? chapterId : bookId))
    throw new ForbiddenError('Image is already attached to another work');
  return a;
}
function text(value: any, label: string, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > 255) throw new BadRequestError(`${label} is required (maximum 255 characters)`);
  return value.trim();
}
function choice(value: any, values: string[]) { if (!values.includes(value)) throw new BadRequestError('Invalid publication state or visibility'); return value; }

// Author row lock serializes saves, numbering and idempotency across application instances.
export async function savePublication(userId: number, body: any, kind: 'book' | 'chapter', bookId?: number, chapterId?: number) {
  if (!uuid.test(body.requestId ?? '')) throw new BadRequestError('A valid requestId is required');
  const hash = createHash('sha256').update(JSON.stringify({ body, kind, bookId, chapterId })).digest('hex');
  const result = await transaction(async db => {
    const authorId = await author(db, userId);
    const [prior] = await rows(db, 'SELECT * FROM publishing_requests WHERE author_id = ? AND request_id = ?', [authorId, body.requestId]);
    if (prior) {
      if (prior.payload_hash !== hash) throw new ConflictRequestError('This save was already used. Reload before saving changes.');
      return typeof prior.result_json === 'string' ? JSON.parse(prior.result_json) : prior.result_json;
    }
    let b = bookId ? await book(db, bookId, authorId) : null;
    const [existingChapter] = chapterId ? await rows(db, 'SELECT * FROM chapters WHERE id=? AND book_id=? AND author_id=? AND deleted_at IS NULL FOR UPDATE', [chapterId,bookId,authorId]) : [];
    if (chapterId && !existingChapter) throw new NotFoundError('Chapter not found');
    const previous = kind === 'book' ? b : existingChapter;
    const title = text(body.title ?? previous?.title, 'Title');
    const visibility = choice(body.visibility ?? previous?.visibility ?? 'PUBLIC', ['PUBLIC', 'MEMBERS', 'TIERS']);
    let output: any;
    if (kind === 'book') {
      const genre = text(body.genre ?? b?.genre, 'Genre');
      const status = choice(body.status ?? b?.status ?? 'DRAFT', ['DRAFT', 'PUBLISHED', 'HIDDEN']);
      if (body.coverUrl && body.coverUrl !== b?.cover_image_url) throw new BadRequestError('Use the cover image picker');
      const asset = body.coverAssetId ? await attachable(db, body.coverAssetId, authorId, 'cover', bookId) : null;
      const cover = asset?.image_url ?? (body.removeCover ? null : b?.cover_image_url ?? null);
      const synopsis = String(body.synopsis ?? b?.synopsis ?? '');
      if (!b) {
        const slug = (String(body.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180) || 'book') + '-' + randomUUID().slice(0, 8);
        const [r]: any = await db.query(`INSERT INTO books (author_id,title,genre,slug,synopsis,cover_image_url,status,visibility) VALUES (?,?,?,?,?,?,?,?)`, [authorId,title,genre,slug,synopsis,cover,status,visibility]);
        bookId = r.insertId; b = { id: bookId, slug };
      } else await db.query('UPDATE books SET title=?,genre=?,synopsis=?,cover_image_url=?,status=?,visibility=? WHERE id=?', [title,genre,synopsis,cover,status,visibility,bookId]);
      if (asset || body.removeCover) {
        await db.query('DELETE FROM book_covers WHERE book_id=?', [bookId]);
        if (asset) await db.query('INSERT INTO book_covers (book_id,asset_id) VALUES (?,?)', [bookId,asset.id]);
      }
      if (body.tags !== undefined) {
        if (!Array.isArray(body.tags) || body.tags.length > 30 || body.tags.some((t: any) => typeof t !== 'string' || !t.trim() || t.length > 100)) throw new BadRequestError('Invalid tags');
        await db.query('DELETE FROM book_tags WHERE book_id=?', [bookId]);
        for (const name of new Set<string>(body.tags)) {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          await db.query('INSERT INTO tags (slug,name) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)', [slug,name]);
          await db.query('INSERT IGNORE INTO book_tags (book_id,tag_id) SELECT ?,id FROM tags WHERE slug=?', [bookId,slug]);
        }
      }
      output = { id: bookId, slug: b.slug };
    } else {
      if (!b) throw new NotFoundError('Book not found');
      const existing = existingChapter;
      const content = String(body.contentMd ?? body.contentMarkdown ?? existing?.content_md ?? '');
      const ids = body.imageAssetIds ?? (existing ? (await getChapterImages(chapterId!, db)).map(i => i.id) : []);
      validateAssetIds(ids);
      if (![true,false,0,1,undefined].includes(body.isDraft)) throw new BadRequestError('Invalid draft state');
      const isDraft = body.isDraft === undefined ? (existing?.is_draft ?? 1) : Number(Boolean(body.isDraft));
      if (!isDraft && !content.trim() && !ids.length) throw new BadRequestError('Add chapter text or at least one page before publishing');
      for (const id of ids) await attachable(db,id,authorId,'chapter',bookId,chapterId);
      let chapterNo = existing?.chapter_no;
      if (!existing) {
        const [max] = await rows(db, 'SELECT COALESCE(MAX(chapter_no),0)+1 AS nextNo FROM chapters WHERE book_id=?', [bookId]);
        chapterNo = Number(max.nextNo);
        const [r]: any = await db.query(`INSERT INTO chapters (book_id,author_id,title,slug,chapter_no,content_md,visibility,is_draft,published_at) VALUES (?,?,?,?,?,?,?,?,IF(?=0,NOW(),NULL))`, [bookId,authorId,title,`chapter-${chapterNo}`,chapterNo,content,visibility,isDraft,isDraft]);
        chapterId = r.insertId;
      } else await db.query(`UPDATE chapters SET title=?,content_md=?,visibility=?,is_draft=?,published_at=IF(?=0,COALESCE(published_at,NOW()),NULL) WHERE id=?`, [title,content,visibility,isDraft,isDraft,chapterId]);
      // Preserve the optional legacy metadata contract within the same transaction.
      const scheduled = body.scheduledAt !== undefined ? body.scheduledAt : body.plannedReleaseAt;
      if (scheduled !== undefined) {
        const date = scheduled ? new Date(scheduled) : null;
        if (date && !Number.isFinite(date.getTime())) throw new BadRequestError('Invalid scheduled date');
        await db.query('UPDATE chapters SET scheduled_at=? WHERE id=?', [date,chapterId]);
      }
      if (body.wordCount !== undefined) {
        if (!Number.isSafeInteger(body.wordCount) || body.wordCount < 0) throw new BadRequestError('Invalid word count');
        await db.query('UPDATE chapters SET word_count=? WHERE id=?', [body.wordCount,chapterId]);
      }
      if (body.slug !== undefined) await db.query('UPDATE chapters SET slug=? WHERE id=?', [text(body.slug,'Chapter slug'),chapterId]);
      if (!isDraft && body.publishedAt) {
        const date = new Date(body.publishedAt);
        if (!Number.isFinite(date.getTime())) throw new BadRequestError('Invalid publication date');
        await db.query('UPDATE chapters SET published_at=? WHERE id=?', [date,chapterId]);
      }
      await db.query('DELETE FROM chapter_images WHERE chapter_id=?', [chapterId]);
      for (const [order,id] of ids.entries()) await db.query('INSERT INTO chapter_images (chapter_id,asset_id,page_order) VALUES (?,?,?)', [chapterId,id,order+1]);
      output = { chapterId, chapterNo, bookId, slug: b.slug };
    }
    await db.query('INSERT INTO publishing_requests (author_id,request_id,payload_hash,result_json) VALUES (?,?,?,?)', [authorId,body.requestId,hash,JSON.stringify(output)]);
    return output;
  });
  // A cache outage after commit must not turn a successful save into a failed publication.
  await Promise.allSettled([cacheDel(`book:${result.slug}`), ...(result.chapterId ? [cacheDel(`chapter:${result.chapterId}`)] : [])]);
  return result;
}
