import { pool } from '../../dbs/init.mysql';

export const listChapterHeadersByBook = async (bookId: number) => {
  const [rows] = await pool.query(
    `SELECT id, chapter_no AS \`index\`, title,
            visibility, published_at AS releaseAt,
            CASE WHEN is_draft = 0 AND published_at IS NOT NULL THEN 1 ELSE 0 END AS isPublished
     FROM chapters
     WHERE book_id = ? AND deleted_at IS NULL
     ORDER BY chapter_no ASC`,
    [bookId],
  );
  return rows as any[];
};

export const findChapterByBookAndNoPublic = async (bookId: number, chapterNo: number) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM chapters
     WHERE book_id = ? AND chapter_no = ? AND deleted_at IS NULL
     LIMIT 1`,
    [bookId, chapterNo],
  );
  return (rows as any[])[0] || null;
};

export const createChapter = async (data: {
  bookId: number;
  authorId: number;
  title: string;
  slug: string;
  contentMd: string;
  visibility: 'PUBLIC'|'MEMBERS'|'TIERS';
  isDraft: number;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  wordCount?: number | null;
}) => {
  const [maxRows] = await pool.query(
    `SELECT COALESCE(MAX(chapter_no), 0) AS mx
     FROM chapters WHERE book_id = ? AND deleted_at IS NULL`,
    [data.bookId],
  );
  const nextNo = ((maxRows as any[])[0]?.mx ?? 0) + 1;

  const [res] = await pool.query(
    `INSERT INTO chapters
      (book_id, author_id, title, slug, chapter_no, content_md, word_count, visibility, is_draft, scheduled_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.bookId,
      data.authorId,
      data.title,
      data.slug,
      nextNo,
      data.contentMd,
      data.wordCount ?? null,
      data.visibility,
      data.isDraft,
      data.scheduledAt ?? null,
      data.publishedAt ?? null,
    ],
  );

  return { chapterId: (res as any).insertId as number, chapterNo: nextNo };
};

export const updateChapter = async (chapterId: number, authorId: number, patch: any) => {
  const fields: string[] = [];
  const values: any[] = [];

  const map: Record<string, string> = {
    title: 'title',
    slug: 'slug',
    content_md: 'content_md',
    word_count: 'word_count',
    visibility: 'visibility',
    is_draft: 'is_draft',
    scheduled_at: 'scheduled_at',
    published_at: 'published_at',
  };

  for (const key of Object.keys(map)) {
    if (patch[key] !== undefined) {
      fields.push(`${map[key]} = ?`);
      values.push(patch[key]);
    }
  }

  if (fields.length === 0) return 0;

  values.push(chapterId, authorId);

  const [res] = await pool.query(
    `UPDATE chapters SET ${fields.join(', ')}
     WHERE id = ? AND author_id = ? AND deleted_at IS NULL`,
    values,
  );

  return (res as any).affectedRows as number;
};

export const listChapterHeadersByBookForAuthor = async (bookId: number, authorId: number) => {
  const [rows] = await pool.query(
    `SELECT id,
            chapter_no AS \`index\`,
            title,
            slug,
            visibility,
            is_draft,
            scheduled_at,
            published_at
     FROM chapters
     WHERE book_id = ? AND author_id = ? AND deleted_at IS NULL
     ORDER BY chapter_no ASC`,
    [bookId, authorId],
  );

  return rows as any[];
};

export const findChapterByIdForAuthor = async (chapterId: number, authorId: number) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM chapters
     WHERE id = ? AND author_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [chapterId, authorId],
  );

  return (rows as any[])[0] || null;
};
