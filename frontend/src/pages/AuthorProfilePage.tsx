import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import { useAuthStore } from "../store/useAuthStore";
import Header from "./HomePage/Header";
import StoryCard from "../features/catalog/StoryCard";
import type { PublicAuthor, StorySummary } from "../features/catalog/types";
export default function AuthorProfilePage() {
  const { authorId } = useParams(),
    [params, setParams] = useSearchParams(),
    userId = useAuthStore((s) => s.authUser?.id),
    [author, setAuthor] = useState<PublicAuthor | null>(null),
    [books, setBooks] = useState<{
      items: StorySummary[];
      page: number;
      limit: number;
      total: number;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void Promise.all([
      api.get(`/authors/${authorId}/profile`, { signal: controller.signal }),
      api.get(`/books/${authorId}/books`, {
        params: { page: params.get("page") || 1, limit: 12 },
        signal: controller.signal,
      }),
    ])
      .then(([profile, list]) => {
        if (!controller.signal.aborted) {
          setAuthor(profile.data.metadata);
          setBooks(list.data.metadata);
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setAuthor(null);
          setError(message(e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authorId, params, userId, retry]);
  async function follow() {
    if (!author || busy) return;
    setBusy(true);
    try {
      await api.put(`/authors/${author.id}/follow`, {
        followed: !author.isFollowing,
      });
      const { data } = await api.get(`/authors/${author.id}/profile`);
      setAuthor(data.metadata);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      <main
        id="main-content"
        className="mx-auto max-w-6xl p-4 md:p-10 space-y-8"
      >
        <Link className="link" to="/">
          ← Browse stories
        </Link>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}{" "}
            <button
              className="btn btn-sm"
              onClick={() => setRetry((v) => v + 1)}
            >
              Retry author
            </button>
          </p>
        )}
        {loading ? (
          <p role="status">Loading author…</p>
        ) : (
          author && (
            <>
              <section className="card bg-base-100 p-6 md:p-8 space-y-5">
                <p className="text-sm uppercase font-semibold tracking-wide text-primary">
                  Author
                </p>
                <h1 className="text-4xl font-bold">{author.penName}</h1>
                <p className="whitespace-pre-wrap leading-8">
                  {author.bio || "This author has not added a biography yet."}
                </p>
                <p>
                  {author.bookCount} published stories · {author.followerCount}{" "}
                  followers
                </p>
                <nav
                  className="flex flex-wrap gap-3"
                  aria-label="Author actions"
                >
                  <Link className="btn" to={`/author/${author.id}/memberships`}>
                    Membership plans
                  </Link>
                  <Link className="btn" to={`/author/${author.id}/posts`}>
                    Author posts
                  </Link>
                  <Link className="btn" to={`/author/${author.id}/donate`}>
                    Donate
                  </Link>
                  <Link
                    className="btn"
                    to={`/account/messages?author=${author.id}`}
                  >
                    Member chat
                  </Link>
                  {author.isOwner ? (
                    <Link className="btn" to="/author/profile">
                      Edit author profile
                    </Link>
                  ) : userId ? (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void follow()}
                    >
                      {author.isFollowing ? "Unfollow author" : "Follow author"}
                    </button>
                  ) : (
                    <Link className="btn" to="/login">
                      Sign in to follow
                    </Link>
                  )}
                </nav>
              </section>
              <section className="space-y-5">
                <h2 className="text-2xl font-bold">Published stories</h2>
                {!books?.items.length ? (
                  <p className="card bg-base-100 p-6">
                    No stories have been published yet.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {books.items.map((book) => (
                      <StoryCard key={book.id} story={book} />
                    ))}
                  </div>
                )}
                {books && books.total > books.limit && (
                  <nav
                    aria-label="Author story pages"
                    className="flex items-center gap-4"
                  >
                    <button
                      className="btn"
                      disabled={books.page <= 1}
                      onClick={() =>
                        setParams({ page: String(books.page - 1) })
                      }
                    >
                      Previous page
                    </button>
                    <span>Page {books.page}</span>
                    <button
                      className="btn"
                      disabled={books.page * books.limit >= books.total}
                      onClick={() =>
                        setParams({ page: String(books.page + 1) })
                      }
                    >
                      Next page
                    </button>
                  </nav>
                )}
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}
