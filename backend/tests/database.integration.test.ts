import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
// Explicit opt-in and a dedicated schema. Never point these tests at an existing user database.
const enabled = process.env.PUBLISHING_TEST_DATABASE === 'publishing_qa';
describe.skipIf(!enabled)('real MySQL publishing lifecycle', () => {
  let pool: typeof import('../src/dbs/init.mysql').pool;
  let save: typeof import('../src/services/publishing.service').savePublication;
  let images: typeof import('../src/services/publishing.service').getChapterImages;
  let userId: number; let authorId: number; let bookId: number; let chapterId: number;
  const assetIds = [randomUUID(),randomUUID(),randomUUID()];
  const requestId = randomUUID();
  beforeAll(async () => {
    process.env.MYSQL_HOST = '127.0.0.1'; process.env.MYSQL_PORT = '3307';
    process.env.MYSQL_USER = 'root'; process.env.MYSQL_PASSWORD = 'publishing-qa-local'; process.env.MYSQL_DB = 'publishing_qa';
    ({ pool } = await import('../src/dbs/init.mysql'));
    const { runMigrationsOnce } = await import('../src/dbs/migrate');
    await runMigrationsOnce(); await runMigrationsOnce();
    ({ savePublication: save, getChapterImages: images } = await import('../src/services/publishing.service'));
    const [u]: any = await pool.query('INSERT INTO users (email,password_hash) VALUES (?,?)', [`qa-${randomUUID()}@example.invalid`,'test-only']); userId=u.insertId;
    const [a]: any = await pool.query('INSERT INTO authors (user_id,pen_name,is_approved) VALUES (?,?,1)', [userId,'Publishing QA']); authorId=a.insertId;
  },30000);
  afterAll(async () => { await pool?.end(); });
  it('creates a book exactly once under concurrent retries', async () => {
    const body = { requestId,title:'QA Book',genre:'Comic',status:'DRAFT' };
    const results = await Promise.all([save(userId,body,'book'), save(userId,body,'book')]);
    expect(results[0]).toEqual(results[1]); bookId=results[0].id;
    await expect(save(userId,{...body,title:'Different'},'book')).rejects.toMatchObject({status:409});
  });
  it('stores ordered confirmed references and publishes image-only content atomically', async () => {
    for (const id of assetIds) await pool.query(`INSERT INTO publishing_assets (id,author_id,book_id,purpose,public_id,expected_bytes,expected_format,cloud_asset_id,image_url,confirmed_at,expires_at)
      VALUES (?,?,?,'chapter',?,4,'png',?,?,NOW(),DATE_ADD(NOW(),INTERVAL 1 HOUR))`,[id,authorId,bookId,`qa/${id}`,`qa-${id}`,`https://example.invalid/${id}.png`]);
    const result=await save(userId,{requestId:randomUUID(),title:'Pages',imageAssetIds:assetIds,isDraft:false},'chapter',bookId); chapterId=result.chapterId;
    expect((await images(chapterId)).map(i=>i.id)).toEqual(assetIds);
    const [rows]: any=await pool.query('SELECT * FROM chapters WHERE id=?',[chapterId]);
    expect(rows[0].is_draft).toBe(0); expect(rows[0].published_at).toBeTruthy(); expect(rows[0].content_md).toBe('');
  });
  it('reorders and removes existing pages without uploads, and supports unpublish/republish',async()=>{
    await save(userId,{requestId:randomUUID(),title:'Pages edited',imageAssetIds:[assetIds[2],assetIds[0]],isDraft:true},'chapter',bookId,chapterId);
    expect((await images(chapterId)).map(i=>i.id)).toEqual([assetIds[2],assetIds[0]]);
    const [draft]:any=await pool.query('SELECT is_draft,published_at FROM chapters WHERE id=?',[chapterId]); expect(draft[0]).toMatchObject({is_draft:1,published_at:null});
    await save(userId,{requestId:randomUUID(),isDraft:false},'chapter',bookId,chapterId);
    expect(await images(chapterId)).toHaveLength(2);
  });
  it('preserves legacy Markdown on partial updates and rejects wrong book scope',async()=>{
    const legacy=await save(userId,{requestId:randomUUID(),title:'Legacy',contentMd:'![Page](https://example.invalid/legacy.png)',isDraft:false},'chapter',bookId);
    await save(userId,{requestId:randomUUID(),title:'Legacy edited'},'chapter',bookId,legacy.chapterId);
    const [rows]:any=await pool.query('SELECT content_md FROM chapters WHERE id=?',[legacy.chapterId]); expect(rows[0].content_md).toContain('![Page]');
    const other=await save(userId,{requestId:randomUUID(),title:'Other',genre:'Comic'},'book');
    await expect(save(userId,{requestId:randomUUID(),title:'Wrong'},'chapter',other.id,chapterId)).rejects.toMatchObject({status:404});
  });
  it('replaces covers only after confirmation and retains old asset metadata',async()=>{
    const coverIds=[randomUUID(),randomUUID()];
    for(const id of coverIds) await pool.query(`INSERT INTO publishing_assets (id,author_id,book_id,purpose,public_id,expected_bytes,expected_format,image_url,confirmed_at,expires_at)
      VALUES (?,?,?,'cover',?,4,'png',?,NOW(),DATE_ADD(NOW(),INTERVAL 1 HOUR))`,[id,authorId,bookId,`qa/${id}`,`https://example.invalid/${id}.png`]);
    for(const id of coverIds) await save(userId,{requestId:randomUUID(),coverAssetId:id},'book',bookId);
    const [rows]:any=await pool.query('SELECT cover_image_url FROM books WHERE id=?',[bookId]); expect(rows[0].cover_image_url).toContain(coverIds[1]);
    const [assets]:any=await pool.query('SELECT id FROM publishing_assets WHERE id IN (?,?)',coverIds); expect(assets).toHaveLength(2);
  });
  it('rolls back publication changes on a real database constraint failure',async()=>{
    const [[before]]:any=await pool.query('SELECT title,is_draft FROM chapters WHERE id=?',[chapterId]);
    const [[other]]:any=await pool.query('SELECT slug FROM chapters WHERE book_id=? AND id<>? LIMIT 1',[bookId,chapterId]);
    await expect(save(userId,{requestId:randomUUID(),title:'Must roll back',isDraft:true,slug:other.slug},'chapter',bookId,chapterId)).rejects.toMatchObject({code:'ER_DUP_ENTRY'});
    const [[after]]:any=await pool.query('SELECT title,is_draft FROM chapters WHERE id=?',[chapterId]);
    expect(after).toEqual(before); expect(await images(chapterId)).toHaveLength(2);
  });
  it('rejects cross-author assets using real ownership records',async()=>{
    const [u]:any=await pool.query('INSERT INTO users (email,password_hash) VALUES (?,?)',[`foreign-${randomUUID()}@example.invalid`,'test-only']);
    const [a]:any=await pool.query('INSERT INTO authors (user_id,is_approved) VALUES (?,1)',[u.insertId]);
    const foreign= randomUUID();
    await pool.query(`INSERT INTO publishing_assets (id,author_id,book_id,purpose,public_id,expected_bytes,expected_format,image_url,confirmed_at,expires_at)
      VALUES (?,?,?,'chapter',?,4,'png','https://example.invalid/foreign.png',NOW(),DATE_ADD(NOW(),INTERVAL 1 HOUR))`,[foreign,a.insertId,bookId,`qa/${foreign}`]);
    await expect(save(userId,{requestId:randomUUID(),imageAssetIds:[foreign]},'chapter',bookId,chapterId)).rejects.toMatchObject({status:403});
    expect(await images(chapterId)).toHaveLength(2);
  });
});
