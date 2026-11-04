import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { publicationService } from './publicationService';
import { useThemeStore } from '../../store/useThemeStore';
import { ImageEditor } from './ImageEditor';
import { message, uploadImages, type EditorImage } from './images';

interface Form { title: string; genre: string; synopsis: string; contentMd: string; visibility: string; status: string; tags: string; }
const empty: Form = { title: '', genre: '', synopsis: '', contentMd: '', visibility: 'PUBLIC', status: 'DRAFT', tags: '' };
interface PageImage { id: string; imageUrl: string; }
export default function PublicationEditor({ kind, edit = false }: { kind: 'book' | 'chapter'; edit?: boolean }) {
  const params = useParams();
  const bookId = params.bookId ? Number(params.bookId) : undefined;
  const chapterId = params.chapterId ? Number(params.chapterId) : undefined;
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const [form, setForm] = useState<Form>(empty);
  const [images, setImages] = useState<EditorImage[]>([]);
  const [bookTitle, setBookTitle] = useState('');
  const [loading, setLoading] = useState(edit || kind === 'chapter');
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const lock = useRef(false);
  const allowNavigation = useRef(false);
  const blocker = useBlocker(() => !allowNavigation.current && (dirty || lock.current));
  const request = useRef<{ id: string; payload: string } | null>(null);
  const endpoint = kind === 'book' ? `/authors/me/books${edit ? `/${bookId}` : ''}` : `/authors/me/books/${bookId}/chapters${edit ? `/${chapterId}` : ''}`;
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!edit && kind === 'book') return;
      setLoading(true); setError(''); setLoadFailed(false);
      try {
        const b = await publicationService.getBook(bookId!);
        const data = kind === 'chapter' && edit ? await publicationService.getChapter(endpoint) : b;
        if (cancelled) return;
        setBookTitle(b.title);
        if (edit) {
          setForm({ title: data.title, genre: data.genre ?? '', synopsis: data.synopsis ?? '', contentMd: data.contentMarkdown ?? '',
            visibility: data.visibility, status: kind === 'chapter' ? (data.isDraft ? 'DRAFT' : 'PUBLISHED') : data.status,
            tags: (data.tags ?? []).map((t: { name: string }) => t.name).join(', ') });
          setImages(kind === 'book' ? (data.coverUrl ? [{ id: 'existing-cover', previewUrl: data.coverUrl, status: 'uploaded' }] : []) :
            (data.images ?? []).map((i: PageImage) => ({ id: i.id, assetId: i.id, previewUrl: i.imageUrl, status: 'uploaded' })));
        }
      } catch (e) { if (!cancelled) { setError(message(e)); setLoadFailed(true); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [bookId, chapterId, edit, kind, endpoint, loadVersion]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  function field(key: keyof Form, value: string) { setForm(f => ({ ...f, [key]: value })); setDirty(true); }
  async function save(status: string) {
    if (lock.current) return;
    if (!form.title.trim() || (kind === 'book' && !form.genre.trim())) { setError('Enter a title' + (kind === 'book' ? ' and genre.' : '.')); return; }
    if (kind === 'chapter' && status === 'PUBLISHED' && !images.length && !form.contentMd.trim()) { setError('Add at least one image or chapter text before publishing.'); return; }
    lock.current = true; setBusy(true); setError(''); setProgress('Preparing images…');
    try {
      const uploadable = images.filter(i => i.file || i.assetId);
      const ids = await uploadImages(uploadable, kind === 'book' ? 'cover' : 'chapter', bookId,
        image => setImages(current => current.map(i => i.id === image.id ? image : i)),
        (done, total) => setProgress(`Uploading images: ${done} / ${total} (${total ? Math.round(done / total * 100) : 100}%)`));
      const data = kind === 'book' ? { title: form.title.trim(), genre: form.genre.trim(), synopsis: form.synopsis, visibility: form.visibility,
        status, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), ...(ids[0] ? { coverAssetId: ids[0] } : {}), removeCover: !images.length } :
        { title: form.title.trim(), contentMd: form.contentMd, visibility: form.visibility, isDraft: status === 'DRAFT', imageAssetIds: ids };
      const payload = JSON.stringify(data);
      if (!request.current || request.current.payload !== payload) request.current = { id: crypto.randomUUID(), payload };
      setProgress(status === 'PUBLISHED' ? 'Publishing…' : 'Saving draft…');
      const result = await publicationService.save(endpoint, edit, { ...data, requestId: request.current.id });
      setDirty(false); setForm(f => ({ ...f, status }));
      setProgress(status === 'PUBLISHED' ? 'Published successfully.' : 'Draft saved successfully.');
      request.current = null;
      if (!edit) {
        allowNavigation.current = true;
        navigate(kind === 'book' ? `/author/comic/${result.id}/edit` : `/author/comic/${bookId}/chapter/${result.chapterId}/edit`, { replace: true });
      }
    } catch (e) { setError(message(e)); setProgress('Save did not complete. Your work is preserved; retry when ready.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const input = 'input input-bordered w-full';
  return <main className={`min-h-screen pt-24 pb-16 px-4 ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
    <div className="max-w-4xl mx-auto">
      <Link to="/author/dashboard" className="link">← My books</Link>
      <h1 className="text-3xl font-bold my-4">{edit ? 'Edit' : 'Create'} {kind}{kind === 'chapter' && bookTitle ? ` · ${bookTitle}` : ''}</h1>
      <p>{dirty ? 'Unsaved changes' : 'Ready'} · {form.status === 'PUBLISHED' ? 'Published' : form.status === 'HIDDEN' ? 'Hidden' : 'Draft'}</p>
      {error && <div role="alert" className="alert alert-error my-4">{error}</div>}
      {loading ? <p role="status">Loading…</p> : loadFailed ? <button className="btn" onClick={() => setLoadVersion(v => v + 1)}>Retry loading</button> : <form onSubmit={e => { e.preventDefault(); void save('DRAFT'); }} className="my-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block">Title<input aria-label="Title" className={input} value={form.title} maxLength={255} required onChange={e => field('title', e.target.value)} /></label>
          {kind === 'book' && <>
            <label className="block">Genre<input aria-label="Genre" className={input} value={form.genre} required maxLength={255} onChange={e => field('genre', e.target.value)} /></label>
            <label className="block">Synopsis<textarea aria-label="Synopsis" className="textarea textarea-bordered w-full" rows={4} value={form.synopsis} onChange={e => field('synopsis', e.target.value)} /></label>
            <label className="block">Tags (separate with commas)<input aria-label="Tags" className={input} value={form.tags} onChange={e => field('tags', e.target.value)} /></label>
          </>}
          <label className="block">Visibility<select aria-label="Visibility" className="select select-bordered w-full" value={form.visibility} onChange={e => field('visibility', e.target.value)}><option value="PUBLIC">Public</option><option value="MEMBERS">Members</option><option value="TIERS">Membership tiers</option></select></label>
          <ImageEditor images={images} disabled={busy} cover={kind === 'book'} onChange={value => { setImages(value); setDirty(true); }} />
          {kind === 'chapter' && <details open={!!form.contentMd}><summary>Chapter text / existing Markdown (optional)</summary><textarea aria-label="Chapter text" rows={8} className="textarea textarea-bordered w-full" value={form.contentMd} onChange={e => field('contentMd', e.target.value)} /></details>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn">Save Draft</button>
            <button type="button" className="btn btn-warning" onClick={() => void save('PUBLISHED')}>{kind === 'chapter' ? 'Publish Chapter' : 'Publish Book'}</button>
            {kind === 'book' && edit && <button type="button" className="btn" onClick={() => void save('HIDDEN')}>Hide Book</button>}
          </div>
        </fieldset>
      </form>}
      <p role="status" aria-label="Save progress" aria-live="polite" className="my-4">{progress}</p>
      {blocker.state === 'blocked' && <div role="dialog" aria-modal="true" aria-label="Unsaved changes" className="border rounded-xl p-5 bg-base-200">
        <p>{busy ? 'Saving is in progress. Please wait before leaving.' : 'Leave and discard unsaved changes?'}</p>
        <button type="button" className="btn" onClick={() => blocker.reset()}>Stay</button>
        {!busy && <button type="button" className="btn" onClick={() => blocker.proceed()}>Discard and leave</button>}
      </div>}
      {kind === 'book' && edit && <Link className="btn" to={`/author/comic/${bookId}/chapter/create`}>Create Chapter</Link>}
    </div>
  </main>;
}
