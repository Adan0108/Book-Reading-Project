import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../features/admin/AdminLayout";
import { useApiResource } from "../lib/useApiResource";
import api from "../lib/axios";
import { message } from "../features/author/images";
import NovelContent from "../features/reader/NovelContent";
import type { NovelDocument } from "../features/studio/document";
interface Content {
  id: number;
  title: string;
  authorName: string;
  publicationState: string;
  hidden: boolean;
  moderationVersion: number;
  moderationReason: string | null;
}
interface Preview {
  title: string;
  text: string | null;
  contentDocument: NovelDocument | null;
  images: { id: string; imageUrl: string }[];
  coverUrl: string | null;
}
export default function AdminContentPage() {
  const previewRequest = useRef(0);
  const [params, setParams] = useSearchParams(),
    kind = ["BOOK", "CHAPTER", "POST"].includes(params.get("kind") ?? "")
      ? params.get("kind")!
      : "BOOK";
  const resource = useApiResource<{
      items: Content[];
      nextCursor: number | null;
    }>(
      `/admin/content?${new URLSearchParams({ ...Object.fromEntries(params), kind })}`,
    ),
    [query, setQuery] = useState(params.get("query") ?? ""),
    [selected, setSelected] = useState<Content | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [hidden, setHidden] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function select(row: Content) {
    const attempt = ++previewRequest.current;
    setSelected(row);
    setHidden(row.hidden);
    setReason("");
    setPreview(null);
    setError("");
    try {
      const { data } = await api.get(`/admin/content/${kind}/${row.id}`);
      if (previewRequest.current === attempt) setPreview(data.metadata);
    } catch (e) {
      if (previewRequest.current === attempt) setError(message(e));
    }
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/content/${kind}/${selected.id}`, {
        hidden,
        version: selected.moderationVersion,
        reason,
      });
      setSelected(null);
      setPreview(null);
      setStatus(
        hidden
          ? "Content hidden. Public access is blocked."
          : "Content restored. Its publication and membership rules still apply.",
      );
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminLayout title="Content moderation">
      <p>
        Moderation visibility is separate from the author's draft and
        publication state. Restoring a draft does not publish it.
      </p>
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSelected(null);
          setParams({ kind, query });
        }}
      >
        <label>
          Content type
          <select
            aria-label="Content type"
            className="select select-bordered block mt-2"
            value={kind}
            onChange={(e) => {
              previewRequest.current++;
              setSelected(null);
              setPreview(null);
              setParams({ kind: e.target.value, query: "" });
              setQuery("");
            }}
          >
            <option value="BOOK">Books</option>
            <option value="CHAPTER">Chapters</option>
            <option value="POST">Author posts</option>
          </select>
        </label>
        <label>
          Search content
          <input
            aria-label="Search content"
            className="input input-bordered block mt-2"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="btn">Search</button>
      </form>
      {(error || resource.error) && (
        <p role="alert" className="alert alert-error">
          {error || resource.error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {resource.loading ? (
        <p>Loading content…</p>
      ) : !resource.data?.items.length ? (
        <p>No matching content.</p>
      ) : (
        <div role="region" aria-label="Content table" tabIndex={0} className="overflow-x-auto card bg-base-100 focus-visible:outline-2 focus-visible:outline-primary">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Publication</th>
                <th>Moderation</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.authorName || "Author"}</td>
                  <td>{row.publicationState}</td>
                  <td>{row.hidden ? "Hidden" : "Visible"}</td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => void select(row)}
                    >
                      Review content
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <section className="card bg-base-100 p-6 space-y-5">
          <h2 className="text-xl font-bold">Review: {selected.title}</h2>
          {preview ? (
            <div className="max-h-96 overflow-auto whitespace-pre-wrap leading-8">
              {preview.coverUrl && (
                <img
                  src={preview.coverUrl}
                  alt="Book cover for moderation"
                  className="max-h-64"
                />
              )}
              {preview.contentDocument ? (
                <NovelContent
                  document={preview.contentDocument}
                  images={preview.images}
                />
              ) : (
                <>
                  {preview.images.map((image, i) => (
                    <img
                      key={image.id}
                      src={image.imageUrl}
                      alt={`Chapter illustration ${i + 1}`}
                      loading="lazy"
                    />
                  ))}
                  {preview.text || "No text content."}
                </>
              )}
            </div>
          ) : (
            <p>Loading review text…</p>
          )}
          {selected.moderationReason && (
            <p>Previous moderation reason: {selected.moderationReason}</p>
          )}
          <form
            aria-label="Content moderation"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="flex gap-3 items-center">
              <input
                type="checkbox"
                className="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
              />
              Hidden by moderation
            </label>
            <label className="block">
              Action reason
              <textarea
                aria-label="Action reason"
                required
                maxLength={2000}
                className="textarea textarea-bordered w-full mt-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex gap-3">
              <button className="btn btn-primary" disabled={busy}>
                Save moderation decision
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      <div className="flex gap-3">
        <button className="btn" onClick={resource.reload}>
          Reload content
        </button>
        {resource.data?.nextCursor && (
          <button
            className="btn"
            onClick={() =>
              setParams({
                ...Object.fromEntries(params),
                kind,
                cursor: String(resource.data!.nextCursor),
              })
            }
          >
            Older content
          </button>
        )}
      </div>
    </AdminLayout>
  );
}
