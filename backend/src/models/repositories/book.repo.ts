import { pool } from '../../dbs/init.mysql';

export type BookRow = {
  id: number;
  author_id: number;
  title: string;
  genre: string;
  slug: string;
  synopsis: string | null;
  cover_image_url: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  visibility: 'PUBLIC' | 'MEMBERS' | 'TIERS';
  created_at: string;
  updated_at: string;
};

export const createBook = async (data: {
  authorId: number;
  title: string;
  genre: string;
  slug: string;
  synopsis?: string;
  coverImageUrl?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  visibility?: 'PUBLIC' | 'MEMBERS' | 'TIERS';
}) => {
  const {
    authorId, title, genre, slug,
    synopsis = null,
    coverImageUrl = null,
    status = 'DRAFT',
    visibility = 'PUBLIC',
  } = data;

  const [rs] = await pool.query(
    `INSERT INTO books (author_id, title, genre, slug, synopsis, cover_image_url, status, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [authorId, title, genre, slug, synopsis, coverImageUrl, status, visibility],
  );

  return (rs as any).insertId as number;
};

export const updateBook = async (bookId: number, authorId: number, patch: any) => {
  const fields: string[] = [];
  const values: any[] = [];

  const allowed = [
    'title', 'genre', 'slug', 'synopsis', 'cover_image_url',
    'status', 'visibility',
  ];

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }

  if (fields.length === 0) return 0;

  values.push(bookId, authorId);

  const [rs] = await pool.query(
    `UPDATE books SET ${fields.join(', ')}
     WHERE id = ? AND author_id = ? AND deleted_at IS NULL`,
    values,
  );

  return (rs as any).affectedRows as number;
};

export const findBookByIdForAuthor = async (bookId: number, authorId: number) => {
  const [rows] = await pool.query(
    `SELECT * FROM books WHERE id = ? AND author_id = ? AND deleted_at IS NULL LIMIT 1`,
    [bookId, authorId],
  );
  return (rows as any[])[0] || null;
};

export const findBookBySlugPublic = async (slug: string) => {
  const [rows] = await pool.query(
    `SELECT b.*, a.pen_name
     FROM books b
     JOIN authors a ON a.id = b.author_id
     WHERE b.slug = ? AND b.deleted_at IS NULL AND b.status = 'PUBLISHED'
     LIMIT 1`,
    [slug],
  );
  return (rows as any[])[0] || null;
};

export const listBooksPublic = async (params: {
  query?: string;
  page: number;
  limit: number;
}) => {
  const { query, page, limit } = params;
  const offset = (page - 1) * limit;

  const where: string[] = [`b.deleted_at IS NULL`, `b.status = 'PUBLISHED'`];
  const binds: any[] = [];

  if (query?.trim()) {
    where.push(`(
      b.title LIKE ? OR
      a.pen_name LIKE ? OR
      EXISTS (
        SELECT 1
        FROM book_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE bt.book_id = b.id AND (t.name LIKE ? OR t.slug LIKE ?)
      )
    )`);
    const q = `%${query.trim()}%`;
    binds.push(q, q, q, q);
  }

  const [rows] = await pool.query(
    `SELECT b.id, b.slug, b.title, b.synopsis, b.cover_image_url AS coverUrl,
            a.pen_name AS authorName,
            (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id AND c.deleted_at IS NULL AND c.is_draft = 0) AS totalChapters,
            (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id AND c.deleted_at IS NULL AND c.is_draft = 0 AND c.visibility <> 'PUBLIC') AS membersOnlyChapters
     FROM books b
     JOIN authors a ON a.id = b.author_id
     WHERE ${where.join(' AND ')}
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
    [...binds, limit, offset],
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM books b
     JOIN authors a ON a.id = b.author_id
     WHERE ${where.join(' AND ')}`,
    binds,
  );

  const total = (countRows as any[])[0]?.total ?? 0;
  return { items: rows as any[], total };
};

export const setBookTags = async (bookId: number, tagIds: number[]) => {
  await pool.query(`DELETE FROM book_tags WHERE book_id = ?`, [bookId]);
  for (const id of tagIds) {
    await pool.query(`INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)`, [bookId, id]);
  }
};

export const getBookTags = async (bookId: number) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.slug, t.name
     FROM book_tags bt
     JOIN tags t ON t.id = bt.tag_id
     WHERE bt.book_id = ?
     ORDER BY t.name ASC`,
    [bookId],
  );
  return rows as any[];
};

export async function existsSlug(slug: string): Promise<boolean> {
  const sql = `SELECT 1 FROM books WHERE slug = ? AND deleted_at IS NULL LIMIT 1`;
  const [rows] = await pool.query(sql, [slug]);
  return Array.isArray(rows) && rows.length > 0;
}

export const listBooksByAuthorPublic = async (params: {
  authorId: number;
  query?: string;
  page: number;
  limit: number;
}) => {
  const { authorId, query, page, limit } = params;
  const offset = (page - 1) * limit;

  const where: string[] = [
    `b.deleted_at IS NULL`,
    `b.status = 'PUBLISHED'`,
    `b.author_id = ?`,
  ];
  const binds: any[] = [authorId];

  if (query?.trim()) {
    where.push(`(
      b.title LIKE ? OR
      b.genre LIKE ? OR
      b.synopsis LIKE ?
    )`);
    const q = `%${query.trim()}%`;
    binds.push(q, q, q);
  }

  const [rows] = await pool.query(
    `SELECT b.id, b.slug, b.title, b.synopsis, b.cover_image_url AS coverUrl,
            b.visibility,
            a.pen_name AS authorName,
            (SELECT COUNT(*)
             FROM chapters c
             WHERE c.book_id = b.id
               AND c.deleted_at IS NULL
               AND c.is_draft = 0
               AND c.published_at IS NOT NULL
            ) AS totalChapters,
            (SELECT COUNT(*)
             FROM chapters c
             WHERE c.book_id = b.id
               AND c.deleted_at IS NULL
               AND c.is_draft = 0
               AND c.published_at IS NOT NULL
               AND c.visibility <> 'PUBLIC'
            ) AS membersOnlyChapters
     FROM books b
     JOIN authors a ON a.id = b.author_id
     WHERE ${where.join(' AND ')}
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
    [...binds, limit, offset],
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM books b
     WHERE ${where.join(' AND ')}`,
    binds,
  );

  const total = (countRows as any[])[0]?.total ?? 0;
  return { items: rows as any[], total };
};

export const listMyBooksForAuthor = async (params: {
  authorId: number;
  query?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  page: number;
  limit: number;
}) => {
  const { authorId, query, status, page, limit } = params;
  const offset = (page - 1) * limit;

  const where: string[] = [`b.deleted_at IS NULL`, `b.author_id = ?`];
  const binds: any[] = [authorId];

  if (status) {
    where.push(`b.status = ?`);
    binds.push(status);
  }

  if (query?.trim()) {
    where.push(`(b.title LIKE ? OR b.genre LIKE ? OR b.synopsis LIKE ?)`);
    const q = `%${query.trim()}%`;
    binds.push(q, q, q);
  }

  const [rows] = await pool.query(
    `SELECT b.id, b.slug, b.title, b.synopsis, b.cover_image_url AS coverUrl,
            b.visibility, b.status, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM chapters c
              WHERE c.book_id = b.id
                AND c.deleted_at IS NULL
            ) AS totalAllChapters,
            (SELECT COUNT(*) FROM chapters c
              WHERE c.book_id = b.id
                AND c.deleted_at IS NULL
                AND c.is_draft = 0
                AND c.published_at IS NOT NULL
            ) AS totalPublishedChapters
     FROM books b
     WHERE ${where.join(' AND ')}
     ORDER BY b.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...binds, limit, offset],
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM books b
     WHERE ${where.join(' AND ')}`,
    binds,
  );

  const total = (countRows as any[])[0]?.total ?? 0;
  return { items: rows as any[], total };
};
