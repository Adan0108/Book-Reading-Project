import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), resource: vi.fn(), config: vi.fn(), sign: vi.fn() }));
vi.mock('../src/dbs/init.mysql', () => ({ pool: { query: mocks.query, getConnection: async () => mocks } }));
vi.mock('../src/configs/cloudinary.config', () => ({ default: { config: mocks.config, api: { resource: mocks.resource }, utils: { api_sign_request: mocks.sign } } }));
vi.mock('../src/utils/cache', () => ({ cacheDel: vi.fn() }));
vi.mock('../src/dbs/init.redis', () => ({ getRedis: () => ({ incr: async () => 1, expire: async () => 1 }) }));
import { authorizeUpload, confirmUpload, savePublication, validateAssetIds, validateFile } from '../src/services/publishing.service';

const id = '28dc93d6-122f-4c39-96cc-06d1c54fb223';
const requestId = '38dc93d6-122f-4c39-96cc-06d1c54fb223';
const asset = { id, public_id: 'server/id', author_id: 7, book_id: 10, purpose: 'chapter', expected_bytes: 4, expected_format: 'png', is_valid: 1, expires_at: new Date(Date.now() + 300000) };
describe('publishing security and transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks(); process.env.CLOUDINARY_PUBLISHING_PRESET = 'restricted-test';
    mocks.config.mockReturnValue({ api_key: 'public', cloud_name: 'cloud', api_secret: 'never-expose' });
    mocks.sign.mockReturnValue('signature');
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM authors')) return [[{ id: 7 }]];
      if (sql.includes('FROM books')) return [[{ id: 10, author_id: 7, slug: 'book', title: 'Book', genre: 'Comic' }]];
      if (sql.includes('COUNT(*)')) return [[{ total: 0, recent: 0 }]];
      if (sql.includes('SELECT p.*')) return [[asset]];
      if (sql.includes('FROM publishing_assets')) return [[{ ...asset, confirmed_at: new Date(), image_url: 'https://verified/image.png' }]];
      if (sql.includes('MAX(chapter_no)')) return [[{ nextNo: 2 }]];
      if (sql.includes('SELECT * FROM chapters')) return [[{ id: 20, book_id: 10, title: 'Existing', is_draft: 1, chapter_no: 1 }]];
      if (sql.startsWith('SELECT')) return [[]];
      return [{ insertId: 20, affectedRows: 1 }];
    });
  });
  it.each([{ mimeType: 'image/svg+xml', size: 4, purpose: 'cover' }, { mimeType: 'image/png', size: 10485761, purpose: 'cover' }, { mimeType: 'image/png', size: 4, purpose: 'other' }])('rejects invalid upload metadata %j', body => expect(() => validateFile(body)).toThrow());
  it('signs server-selected identifiers without returning secrets', async () => {
    const auth = await authorizeUpload(1, { mimeType: 'image/png', size: 4, purpose: 'chapter', bookId: 10, publicId: 'forged' });
    expect(auth.params.public_id).toMatch(/^meomic\/publishing\//); expect(auth.params.overwrite).toBe(false);
    expect(auth.params.upload_preset).toBe('restricted-test'); expect(JSON.stringify(auth)).not.toContain('never-expose');
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it('denies non-authors', async () => {
    mocks.query.mockResolvedValue([[]]);
    await expect(authorizeUpload(3, { mimeType: 'image/png', size: 4, purpose: 'cover' })).rejects.toMatchObject({ status: 403 });
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it('enforces shared database quotas', async () => {
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation((sql: string, args: unknown[]) => sql.includes('COUNT(*)') ? [[{ total: 500, recent: 0 }]] : original(sql,args));
    await expect(authorizeUpload(1, { mimeType: 'image/png', size: 4, purpose: 'cover' })).rejects.toMatchObject({ status: 429 });
  });
  it('confirms using only the stored public ID and verifies metadata', async () => {
    // Cloudinary may normalize image bytes even without an incoming transformation.
    mocks.resource.mockResolvedValue({ public_id: 'server/id', resource_type: 'image', type: 'upload', format: 'png', bytes: 3, asset_id: 'cloud-asset', secure_url: 'https://verified/image.png', width: 10, height: 10 });
    expect(await confirmUpload(1, id)).toEqual({ id, imageUrl: 'https://verified/image.png' });
    expect(mocks.resource).toHaveBeenCalledWith('server/id', expect.any(Object));
  });
  it('rejects forged, foreign, expired and mismatching uploads', async () => {
    await expect(confirmUpload(1, 'arbitrary-public-id')).rejects.toMatchObject({ status: 400 });
    mocks.query.mockResolvedValueOnce([[]]); await expect(confirmUpload(2,id)).rejects.toMatchObject({ status: 404 });
    mocks.resource.mockResolvedValue({ public_id: 'forged' }); await expect(confirmUpload(1,id)).rejects.toMatchObject({ status: 400 });
    mocks.query.mockResolvedValueOnce([[{ ...asset, is_valid: 0 }]]); await expect(confirmUpload(1,id)).rejects.toMatchObject({ status: 400 });
  });
  it('confirmation is idempotent and provider failures are recoverable', async () => {
    mocks.query.mockResolvedValueOnce([[{ ...asset, confirmed_at: new Date(), image_url: 'https://saved' }]]);
    expect(await confirmUpload(1,id)).toEqual({ id, imageUrl: 'https://saved' }); expect(mocks.resource).not.toHaveBeenCalled();
    mocks.resource.mockRejectedValue(new Error('Unavailable')); await expect(confirmUpload(1,id)).rejects.toMatchObject({ status: 502 });
  });
  it('rejects duplicate assets', () => expect(() => validateAssetIds([id,id])).toThrow());
  it('creates image-only published chapters transactionally and preserves order', async () => {
    const result = await savePublication(1,{ requestId,title:'New',isDraft:false,imageAssetIds:[id] },'chapter',10);
    expect(result.chapterId).toBe(20); expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledWith('INSERT INTO chapter_images (chapter_id,asset_id,page_order) VALUES (?,?,?)',[20,id,1]);
    const insert = mocks.query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO chapters'))!;
    expect(insert[1][7]).toBe(0);
  });
  it('saves empty drafts but rejects empty published chapters', async () => {
    await savePublication(1,{ requestId,title:'Draft',isDraft:true,imageAssetIds:[] },'chapter',10);
    await expect(savePublication(1,{ requestId,title:'Empty',isDraft:false,imageAssetIds:[] },'chapter',10)).rejects.toMatchObject({ status: 400 });
  });
  it('rolls back a failed image attachment without publishing', async () => {
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation((sql: string,args: unknown[]) => sql.startsWith('INSERT INTO chapter_images') ? Promise.reject(new Error('DB failure')) : original(sql,args));
    await expect(savePublication(1,{ requestId,title:'New',isDraft:false,imageAssetIds:[id] },'chapter',10)).rejects.toThrow('DB failure');
    expect(mocks.rollback).toHaveBeenCalledOnce(); expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('rejects a chapter outside the URL book scope', async () => {
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation((sql: string,args: unknown[]) => sql.includes('SELECT * FROM chapters') ? [[]] : original(sql,args));
    await expect(savePublication(1,{ requestId,title:'Edit' },'chapter',10,99)).rejects.toMatchObject({ status: 404 });
  });
  it('rejects arbitrary cover URLs and cross-author assets', async () => {
    await expect(savePublication(1,{ requestId,title:'Book',genre:'Comic',coverUrl:'https://forged' },'book')).rejects.toMatchObject({ status: 400 });
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation((sql: string,args: unknown[]) => sql.includes('SELECT * FROM publishing_assets') ? [[{ ...asset,author_id:999,confirmed_at:new Date() }]] : original(sql,args));
    await expect(savePublication(1,{ requestId,title:'Edit',imageAssetIds:[id] },'chapter',10,20)).rejects.toMatchObject({ status: 403 });
  });
});
