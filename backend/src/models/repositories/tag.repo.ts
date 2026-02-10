import { pool } from '../../dbs/init.mysql';

export const ensureTags = async (tags: string[]) => {
  const cleaned = Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)));
  if (cleaned.length === 0) return [];

  // slug = lower + replace spaces
  const payload = cleaned.map(name => ({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
  }));

  // insert ignore
  for (const t of payload) {
    await pool.query(
      `INSERT IGNORE INTO tags (slug, name) VALUES (?, ?)`,
      [t.slug, t.name],
    );
  }

  // fetch ids
  const slugs = payload.map(p => p.slug);
  const [rows] = await pool.query(
    `SELECT id, slug, name FROM tags WHERE slug IN (${slugs.map(() => '?').join(',')})`,
    slugs,
  );

  return rows as any[];
};
