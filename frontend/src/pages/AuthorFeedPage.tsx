import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Link, useParams } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import type { AuthorPost } from "../features/membership/types";
import ReportContent from "../features/moderation/ReportContent";
function PostBody({ post }: { post: AuthorPost }) {
  const [revealed, setRevealed] = useState(false);
  const content = (
    <>
      <p className="whitespace-pre-wrap leading-8 break-words">{post.body}</p>
      {post.images?.map((image, index) => (
        <img
          key={image.id}
          src={image.imageUrl}
          alt={`Post artwork ${index + 1}`}
          loading="lazy"
          decoding="async"
          className="w-full h-auto rounded-lg mt-4"
        />
      ))}
    </>
  );
  return post.isSpoiler ? (
    <details onToggle={(e) => setRevealed(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold p-2">
        Spoilers — reveal this update
      </summary>
      {revealed && content}
    </details>
  ) : (
    content
  );
}

export default function AuthorFeedPage() {
  const viewerId = useAuthStore((state) => state.authUser?.id),
    generation = useRef(0);
  const { authorId } = useParams(),
    [items, setItems] = useState<AuthorPost[]>([]),
    [cursor, setCursor] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    generation.current++;
    setItems([]);
    setCursor(null);
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
  }, [authorId, version, viewerId]);
  async function more() {
    const currentGeneration = generation.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/authors/${authorId}/posts`, {
        params: { cursor },
      });
      if (currentGeneration !== generation.current) return;
      setItems((current) => [...current, ...data.metadata.items]);
      setCursor(data.metadata.nextCursor);
    } catch (e) {
      if (currentGeneration === generation.current) setError(message(e));
    } finally {
      if (currentGeneration === generation.current) setLoading(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-base-200 p-6"
    >
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
                <PostBody post={post} />
              )}
              <ReportContent kind="POST" resourceId={post.id} />
            </article>
          ))
        )}
        {error && (
          <button
            className="btn"
            disabled={loading}
            onClick={() => setVersion((v) => v + 1)}
          >
            Retry updates
          </button>
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
