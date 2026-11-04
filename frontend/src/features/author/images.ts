import axios from 'axios';
import api from '../../lib/axios';

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 100;
export interface EditorImage {
  id: string;
  file?: File;
  previewUrl: string;
  assetId?: string;
  intent?: Authorization;
  status: 'local' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
}
interface Authorization {
  id: string; cloudName: string; apiKey: string; signature: string;
  params: Record<string, string | number | boolean>;
}
export function validateImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return `${file.name}: use JPEG, PNG or WebP.`;
  if (!file.size || file.size > MAX_BYTES) return `${file.name}: choose a file up to 10 MB.`;
  return null;
}
export function localImage(file: File): EditorImage {
  return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: 'local' };
}
export function releaseImage(image: EditorImage) {
  if (image.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
}
export function message(error: unknown) {
  return axios.isAxiosError(error) ? String(error.response?.data?.message ?? error.message) : error instanceof Error ? error.message : 'Save failed. Please retry.';
}
// Three workers; each network stage gets one automatic retry. Confirm first on retry
// so a lost Cloudinary response never causes the same successful file to be uploaded again.
export async function uploadImages(images: EditorImage[], purpose: 'cover' | 'chapter' | 'post', bookId: number | undefined,
  update: (image: EditorImage) => void, progress: (completed: number, total: number) => void) {
  let next = 0;
  let completed = images.filter(i => i.assetId).length;
  let failed = false;
  progress(completed, images.length);
  async function upload(image: EditorImage) {
    if (image.assetId) return;
    image.status = 'uploading'; image.error = undefined; update({ ...image });
    try {
      if (!image.file) throw new Error('Select this image again.');
      const invalid = validateImage(image.file); if (invalid) throw new Error(invalid);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (image.intent) {
            try {
              await api.post('/upload/fan-art/confirm', { assetId: image.intent.id }, { timeout: 30000 });
              image.assetId = image.intent.id; break;
            } catch (error) {
              if (axios.isAxiosError(error) && error.response?.status === 400) throw error;
            }
          } else {
            image.intent = (await api.post('/upload/fan-art/authorize', { purpose, bookId, size: image.file.size, mimeType: image.file.type }, { timeout: 30000 })).data.metadata;
            update({ ...image });
          }
          const auth = image.intent!;
          const form = new FormData();
          form.append('file', image.file);
          Object.entries(auth.params).forEach(([key, value]) => form.append(key, String(value)));
          form.append('api_key', auth.apiKey); form.append('signature', auth.signature);
          await axios.post(`https://api.cloudinary.com/v1_1/${encodeURIComponent(auth.cloudName)}/image/upload`, form, { timeout: 120000 });
          await api.post('/upload/fan-art/confirm', { assetId: auth.id }, { timeout: 30000 });
          image.assetId = auth.id; break;
        } catch (error) {
          if (attempt === 1 || (axios.isAxiosError(error) && error.response && error.response.status < 500 && error.response.status !== 429)) throw error;
          await new Promise(resolve => setTimeout(resolve, 750));
        }
      }
      image.status = 'uploaded'; completed++; progress(completed, images.length);
    } catch (error) { image.status = 'failed'; image.error = message(error); failed = true; }
    update({ ...image });
  }
  await Promise.all(Array.from({ length: Math.min(3, images.length) }, async () => {
    while (next < images.length) await upload(images[next++]);
  }));
  if (failed) throw new Error('Some images could not be uploaded. Your work is preserved. Retry saving or replace the failed images.');
  return images.map(i => i.assetId!);
}
