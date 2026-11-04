import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import api from '../../lib/axios';
import { localImage, uploadImages, type EditorImage } from './images';
vi.mock('../../lib/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('axios', () => ({ default: { post: vi.fn(), isAxiosError: () => false } }));
const auth = { id: 'asset', cloudName: 'test', apiKey: 'public', signature: 'signed', params: { timestamp: 1 } };
describe('deferred uploads', () => {
  beforeEach(() => vi.clearAllMocks());
  it('keeps existing assets and uploads/authorizes only new files', async () => {
    vi.mocked(api.post).mockImplementation(async url => ({ data: { metadata: url.endsWith('authorize') ? auth : {} } }));
    vi.mocked(axios.post).mockResolvedValue({});
    const images: EditorImage[] = [{ id: 'old', assetId: 'old', previewUrl: 'https://saved', status: 'uploaded' }, localImage(new File(['x'], 'new.png', { type: 'image/png' }))];
    const ids = await uploadImages(images, 'chapter', 1, vi.fn(), vi.fn());
    expect(ids).toEqual(['old', 'asset']); expect(axios.post).toHaveBeenCalledTimes(1);
    await uploadImages(images, 'chapter', 1, vi.fn(), vi.fn());
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
  it('retains the intent and confirms before retrying an ambiguous upload', async () => {
    vi.mocked(api.post).mockImplementation(async url => ({ data: { metadata: url.endsWith('authorize') ? auth : {} } }));
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Network response lost'));
    const image = localImage(new File(['x'], 'new.png', { type: 'image/png' }));
    await uploadImages([image], 'chapter', 1, vi.fn(), vi.fn());
    expect(image.assetId).toBe('asset'); expect(axios.post).toHaveBeenCalledTimes(1);
  });
  it('preserves local work and reports failure when authorization fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Offline'));
    const image = localImage(new File(['x'], 'new.png', { type: 'image/png' }));
    await expect(uploadImages([image], 'chapter', 1, vi.fn(), vi.fn())).rejects.toThrow('Your work is preserved');
    expect(image.status).toBe('failed'); expect(image.file).toBeDefined(); expect(axios.post).not.toHaveBeenCalled();
  });
  it('bounds network uploads to three workers for a larger chapter', async () => {
    let active=0, peak=0, sequence=0;
    vi.mocked(api.post).mockImplementation(async url => ({ data: { metadata: url.endsWith('authorize') ? {...auth,id:`asset-${sequence++}`} : {} } }));
    vi.mocked(axios.post).mockImplementation(async () => {
      active++; peak=Math.max(peak,active);
      await new Promise(resolve=>setTimeout(resolve,10)); active--;
      return {};
    });
    const images=Array.from({length:8},(_,i)=>localImage(new File(['x'],`${i}.png`,{type:'image/png'})));
    const ids=await uploadImages(images,'chapter',1,vi.fn(),vi.fn());
    expect(peak).toBe(3); expect(ids).toHaveLength(8); expect(new Set(ids).size).toBe(8);
  });
});
