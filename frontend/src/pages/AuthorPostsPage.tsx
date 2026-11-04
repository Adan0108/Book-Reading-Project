import { useEffect, useRef, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router-dom";
import api from "../lib/axios";
import { ImageEditor } from "../features/author/ImageEditor";
import UnsavedWork from "../features/author/UnsavedWork";
import {
  message,
  releaseImage,
  uploadImages,
  type EditorImage,
} from "../features/author/images";
import type { AuthorPost, AuthorTier } from "../features/membership/types";
const empty = {
  title: "",
  body: "",
  visibility: "PUBLIC",
  minimumTierId: "",
  isDraft: true,
  isSpoiler: false,
};
export default function AuthorPostsPage() {
  const [posts, setPosts] = useState<AuthorPost[]>([]),
    [tiers, setTiers] = useState<AuthorTier[]>([]),
    [editing, setEditing] = useState<number | null>(null),
    [form, setForm] = useState(empty),
    [images, setImages] = useState<EditorImage[]>([]),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false),
    pending = useRef<{
      url: string;
      method: string;
      data: Record<string, unknown>;
    } | null>(null);
  async function load() {
    const [list, plans] = await Promise.all([
      api.get("/authors/me/posts"),
      api.get("/authors/me/tiers"),
    ]);
    setPosts(list.data.metadata.items);
    setTiers(plans.data.metadata.tiers);
  }
  useEffect(() => {
    let mounted = true;
    load()
      .catch((e) => {
        if (mounted) setError(message(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  function clear() {
    images.forEach(releaseImage);
    setImages([]);
    setEditing(null);
    setForm(empty);
    setDirty(false);
    pending.current = null;
    setUncertain(false);
  }
  function edit(post: AuthorPost) {
    if (dirty && !window.confirm("Discard unsaved post changes?")) return;
    clear();
    setEditing(post.id);
    setForm({
      title: post.title,
      body: post.body ?? "",
      visibility: post.visibility,
      minimumTierId: String(post.minimumTierId ?? ""),
      isDraft: Boolean(post.isDraft),
      isSpoiler: Boolean(post.isSpoiler),
    });
    setImages(
      (post.images ?? []).map((i) => ({
        id: i.id,
        assetId: i.id,
        previewUrl: i.imageUrl,
        status: "uploaded",
      })),
    );
    setStatus("");
    setError("");
    window.scrollTo({ top: 0 });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    let committed = false;
    try {
      if (!pending.current) {
        const ids = await uploadImages(
          images,
          "post",
          undefined,
          (image) =>
            setImages((current) =>
              current.map((i) => (i.id === image.id ? image : i)),
            ),
          (done, total) =>
            setStatus(
              total ? `Uploading artwork ${done} of ${total}…` : "Saving post…",
            ),
        );
        pending.current = {
          url: `/authors/me/posts${editing ? `/${editing}` : ""}`,
          method: editing ? "PATCH" : "POST",
          data: {
            ...form,
            minimumTierId:
              form.visibility === "TIERS"
                ? Number(form.minimumTierId)
                : undefined,
            imageAssetIds: ids,
            requestId: crypto.randomUUID(),
          },
        };
      }
      await api.request(pending.current);
      committed = true;
      clear();
      setStatus("Post saved.");
      await load();
    } catch (e) {
      if (committed)
        setError(`Post saved, but the list could not reload. ${message(e)}`);
      else {
        setError(message(e));
        if (pending.current) {
          const ambiguous =
            !isAxiosError(e) || !e.response || e.response.status >= 500;
          if (ambiguous) setUncertain(true);
          else {
            pending.current = null;
            setUncertain(false);
          }
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const hidden = posts.find((p) => p.id === editing)?.moderationHidden;
  return (
    <main id="main-content" className="min-h-screen bg-base-200 p-4 sm:p-6">
      <UnsavedWork dirty={dirty} saving={busy} />
      <div className="max-w-4xl mx-auto space-y-6">
        <nav className="flex flex-wrap gap-5">
          <Link to="/author/dashboard">My books</Link>
          <Link to="/author/memberships">Memberships</Link>
        </nav>
        <h1 className="text-3xl font-bold">Author posts</h1>
        <p>
          Share text updates with your readers or members. Artwork is optional.
          Mark story details as spoilers so readers can choose to reveal them.
        </p>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {status && (
          <p role="status" aria-label="Post save progress">
            {status}
          </p>
        )}
        {loading ? (
          <p role="status">Loading posts…</p>
        ) : (
          <>
            <form onSubmit={save} className="card bg-base-100 p-5 space-y-4">
              <h2 className="text-xl font-bold">
                {editing ? "Edit post" : "New post"}
              </h2>
              {hidden && (
                <p role="note" className="alert alert-warning">
                  Hidden by moderation. Saving does not restore public access.
                </p>
              )}
              {uncertain && (
                <p role="note">
                  The save response was uncertain. Retry the same save to
                  confirm its result before editing further.
                </p>
              )}
              <fieldset
                disabled={busy || uncertain}
                className="space-y-4"
                onChange={() => setDirty(true)}
              >
                <label className="block">
                  Post title
                  <input
                    name="title"
                    required
                    maxLength={180}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    className="input input-bordered w-full"
                  />
                </label>
                <label className="block">
                  Post text
                  <textarea
                    aria-label="Post text"
                    name="body"
                    rows={8}
                    maxLength={20000}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className="textarea textarea-bordered w-full"
                  />
                </label>
                <label className="block">
                  Post access
                  <select
                    aria-label="Post access"
                    value={form.visibility}
                    onChange={(e) =>
                      setForm({ ...form, visibility: e.target.value })
                    }
                    className="select select-bordered w-full"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="MEMBERS">All members</option>
                    <option value="TIERS">A required tier</option>
                  </select>
                </label>
                <label className="block">
                  Required tier, when restricted
                  <select
                    aria-label="Required tier, when restricted"
                    value={form.minimumTierId}
                    onChange={(e) =>
                      setForm({ ...form, minimumTierId: e.target.value })
                    }
                    className="select select-bordered w-full"
                  >
                    <option value="">No specific tier</option>
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={form.isSpoiler}
                    onChange={(e) =>
                      setForm({ ...form, isSpoiler: e.target.checked })
                    }
                    className="checkbox"
                  />
                  Contains spoilers
                </label>
                <label className="flex gap-3">
                  <input
                    name="isDraft"
                    type="checkbox"
                    checked={form.isDraft}
                    onChange={(e) =>
                      setForm({ ...form, isDraft: e.target.checked })
                    }
                    className="checkbox"
                  />
                  Keep as a draft
                </label>
              </fieldset>
              <ImageEditor
                artwork
                images={images}
                disabled={busy || uncertain}
                onChange={(next) => {
                  setImages(next);
                  setDirty(true);
                }}
              />
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : uncertain
                      ? "Retry same save"
                      : "Save post"}
                </button>
                {(editing || dirty) && (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !dirty ||
                        window.confirm(
                          "Discard unsaved changes? An uncertain save may already exist.",
                        )
                      )
                        clear();
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
            <section aria-label="Your posts" className="space-y-4">
              <h2 className="text-xl font-bold">Your posts</h2>
              {posts.length ? (
                posts.map((post) => (
                  <article
                    key={post.id}
                    className="card bg-base-100 p-5 flex-row flex-wrap justify-between gap-4"
                  >
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold">{post.title}</h3>
                      <p>
                        {post.isDraft ? "Draft" : "Published"} ·{" "}
                        {post.visibility} {post.isSpoiler ? "· Spoilers" : ""}
                      </p>
                      {post.moderationHidden && (
                        <p className="text-warning">Hidden by moderation</p>
                      )}
                    </div>
                    <button
                      className="btn"
                      disabled={busy || uncertain}
                      onClick={() => edit(post)}
                    >
                      Edit {post.title}
                    </button>
                  </article>
                ))
              ) : (
                <p>No updates yet.</p>
              )}
            </section>
          </>
        )}
        {!loading && error && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              setError("");
              void load().catch((e) => setError(message(e)));
            }}
          >
            Reload posts
          </button>
        )}
      </div>
    </main>
  );
}
