import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import type { StoryDetail } from "../features/catalog/types";
import SaveStoryButton from "../features/catalog/SaveStoryButton";
import ReportContent from "../features/moderation/ReportContent";
interface ChapterLink {
  id: number;
  index: number;
  title: string;
  isLockedForCurrentUser: boolean;
}
export default function BookDetailPage() {
  const { slug } = useParams(),
    [book, setBook] = useState<StoryDetail | null>(null),
    [chapters, setChapters] = useState<ChapterLink[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setBook(null);
    void Promise.all([
      api.get(`/books/${slug}`, { signal: controller.signal }),
      api.get(`/books/${slug}/chapters`, { signal: controller.signal }),
    ])
      .then(([detail, list]) => {
        if (!controller.signal.aborted) {
          setBook(detail.data.metadata);
          setChapters(list.data.metadata.items);
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug, retry]);
  return (
    <div className="min-h-screen bg-base-200">
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-6xl mx-auto p-4 md:p-10 space-y-8"
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
              Retry story
            </button>
          </p>
        )}
        {loading ? (
          <p role="status">Loading story…</p>
        ) : (
          book && (
            <>
              <section className="card bg-base-100 p-6 md:p-8 grid md:grid-cols-[13rem_minmax(0,1fr)] gap-8">
                <div className="aspect-[2/3] max-w-56 bg-base-300 rounded-xl overflow-hidden flex items-center justify-center">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-serif p-5 text-center">
                      {book.title}
                    </span>
                  )}
                </div>
                <div className="space-y-5">
                  <p className="text-sm font-semibold uppercase tracking-wide opacity-70">
                    {book.genre}
                  </p>
                  <h1 className="text-3xl md:text-4xl font-bold">
                    {book.title}
                  </h1>
                  <p>
                    By{" "}
                    <Link
                      className="link"
                      to={`/author/${book.authorProfile.id}`}
                    >
                      {book.authorProfile.penName || "Author"}
                    </Link>
                  </p>
                  <p>
                    {book.totalChapters} released chapters · {book.viewsCount}{" "}
                    recorded views
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {book.tags.map((tag) => (
                      <Link
                        key={tag.id}
                        className="badge badge-outline"
                        to={`/?tag=${encodeURIComponent(tag.slug)}`}
                      >
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {chapters[0] && (
                      <Link
                        className="btn btn-primary"
                        to={`/comic/${book.slug}/chapters/${chapters[0].index}`}
                      >
                        Start reading
                      </Link>
                    )}
                    <Link
                      className="btn"
                      to={`/author/${book.authorProfile.id}/memberships`}
                    >
                      Membership plans
                    </Link>
                  </div>
                  <SaveStoryButton bookId={book.id} slug={book.slug} />
                  {book.visibility !== "PUBLIC" && (
                    <p>
                      This story requires membership with its author. Individual
                      chapters may require a higher tier.
                    </p>
                  )}
                </div>
              </section>
              <section className="card bg-base-100 p-6 md:p-8 space-y-4">
                <h2 className="text-2xl font-bold">About the story</h2>
                <p className="whitespace-pre-wrap leading-8">
                  {book.synopsis || "The author has not added a synopsis yet."}
                </p>
                <ReportContent kind="BOOK" resourceId={book.id} />
              </section>
              <section className="card bg-base-100 p-6 md:p-8 space-y-5">
                <h2 className="text-2xl font-bold">Chapters</h2>
                {!chapters.length ? (
                  <p>No chapters have been released yet.</p>
                ) : (
                  <ol className="divide-y divide-base-300">
                    {chapters.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/comic/${book.slug}/chapters/${c.index}`}
                          className="flex flex-wrap justify-between gap-3 py-4 focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          <span>
                            Chapter {c.index} · {c.title}
                          </span>
                          <span className="text-sm opacity-70">
                            {c.isLockedForCurrentUser
                              ? "Membership required"
                              : "Read chapter"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}
