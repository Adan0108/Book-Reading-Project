import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import type { AuthorPost } from "../features/membership/types";

export default function AuthorFeedPage() {
  const { authorId } = useParams(),
    [items, setItems] = useState<AuthorPost[]>([]),
    [cursor, setCursor] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get(`/authors/${authorId}/posts`)
      .then(({ data }) => {
        if (active) {
          setItems(data.metadata.items);
          setCursor(data.metadata.nextCursor);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorId]);
  async function more() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/authors/${authorId}/posts`, {
        params: { cursor },
      });
      setItems((current) => [...current, ...data.metadata.items]);
      setCursor(data.metadata.nextCursor);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <nav className="flex gap-5">
          <Link to={`/author/${authorId}`}>← Author profile</Link>
          <Link to={`/author/${authorId}/memberships`}>Membership plans</Link>
        </nav>
        <h1 className="text-3xl font-bold">Author updates</h1>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {loading && !items.length ? (
          <p role="status">Loading updates…</p>
        ) : !items.length ? (
          <p>No published posts yet.</p>
        ) : (
          items.map((post) => (
            <article key={post.id} className="card bg-base-100 p-6 space-y-4">
              <h2 className="text-2xl font-bold">{post.title}</h2>
              {post.isLocked ? (
                <>
                  <p>
                    This update is available to eligible members of this author.
                  </p>
                  <Link to={`/author/${authorId}/memberships`} className="btn">
                    View membership plans
                  </Link>
                </>
              ) : (
                <p className="whitespace-pre-wrap leading-8">{post.body}</p>
              )}
            </article>
          ))
        )}
        {cursor && (
          <button className="btn" disabled={loading} onClick={more}>
            {loading ? "Loading…" : "Older updates"}
          </button>
        )}
      </div>
    </main>
  );
}
