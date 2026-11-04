import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import type { AuthorPost, AuthorTier } from "../features/membership/types";

export default function AuthorPostsPage() {
  const [posts, setPosts] = useState<AuthorPost[]>([]),
    [tiers, setTiers] = useState<AuthorTier[]>([]),
    [editing, setEditing] = useState<AuthorPost | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  async function load() {
    const [list, plans] = await Promise.all([
      api.get("/authors/me/posts"),
      api.get("/authors/me/tiers"),
    ]);
    setPosts(list.data.metadata.items);
    setTiers(plans.data.metadata.tiers);
  }
  useEffect(() => {
    load()
      .catch((e: unknown) => setError(message(e)))
      .finally(() => setLoading(false));
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    const values = new FormData(event.currentTarget),
      minimum = String(values.get("minimumTierId") ?? "");
    try {
      await api.request({
        url: `/authors/me/posts${editing ? `/${editing.id}` : ""}`,
        method: editing ? "PATCH" : "POST",
        data: {
          title: values.get("title"),
          body: values.get("body"),
          visibility: values.get("visibility"),
          isDraft: values.has("isDraft"),
          ...(minimum ? { minimumTierId: Number(minimum) } : {}),
        },
      });
      await load();
      setEditing(null);
      setStatus("Post saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <nav className="flex gap-5">
          <Link to="/author/dashboard">← My books</Link>
          <Link to="/author/memberships">Memberships</Link>
        </nav>
        <h1 className="text-3xl font-bold">Author posts</h1>
        <p>
          Share updates publicly or with your members. Membership rules are
          checked before a reader receives the post text.
        </p>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {loading ? (
          <p role="status">Loading posts…</p>
        ) : (
          <>
            <form
              key={editing?.id ?? `new-${posts.length}`}
              onSubmit={save}
              className="card bg-base-100 p-6 space-y-4"
            >
              <h2 className="text-xl font-bold">
                {editing ? "Edit post" : "New post"}
              </h2>
              <fieldset disabled={busy} className="space-y-4">
                <label className="block">
                  Post title
                  <input
                    name="title"
                    required
                    maxLength={180}
                    defaultValue={editing?.title ?? ""}
                    className="input input-bordered w-full"
                  />
                </label>
                <label className="block">
                  Post text
                  <textarea
                    aria-label="Post text"
                    name="body"
                    maxLength={20000}
                    rows={8}
                    defaultValue={editing?.body ?? ""}
                    className="textarea textarea-bordered w-full"
                  />
                </label>
                <label className="block">
                  Post access
                  <select
                    aria-label="Post access"
                    name="visibility"
                    defaultValue={editing?.visibility ?? "PUBLIC"}
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
                    name="minimumTierId"
                    defaultValue={editing?.minimumTierId ?? ""}
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
                <label className="flex items-center gap-3">
                  <input
                    name="isDraft"
                    type="checkbox"
                    defaultChecked={editing?.isDraft ?? true}
                    className="checkbox"
                  />
                  Keep as a draft
                </label>
                <button type="submit" className="btn btn-primary">
                  {busy ? "Saving…" : "Save post"}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="btn ml-2"
                    onClick={() => setEditing(null)}
                  >
                    Cancel edit
                  </button>
                )}
              </fieldset>
            </form>
            <section className="space-y-4" aria-label="Your posts">
              <h2 className="text-xl font-bold">Your posts</h2>
              {posts.length === 0 ? (
                <p>No updates yet.</p>
              ) : (
                posts.map((post) => (
                  <article
                    key={post.id}
                    className="card bg-base-100 p-5 flex-row justify-between gap-4"
                  >
                    <div>
                      <h3 className="font-semibold">{post.title}</h3>
                      <p>
                        {post.isDraft ? "Draft" : "Published"} ·{" "}
                        {post.visibility === "PUBLIC"
                          ? "Public"
                          : post.visibility === "MEMBERS"
                            ? "Members"
                            : "Required tier"}
                      </p>
                    </div>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        setEditing(post);
                        setStatus("");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit {post.title}
                    </button>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
