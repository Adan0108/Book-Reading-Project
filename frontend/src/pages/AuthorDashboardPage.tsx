import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApiResource } from "../lib/useApiResource";
import AuthorStats from "../features/author/AuthorStats";
import AuthorNavigation from "../features/author/AuthorNavigation";
interface OwnedBook {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  visibility: string;
  status: string;
  totalAllChapters: number;
  totalPublishedChapters: number;
}
interface Chapter {
  id: number;
  index: number;
  title: string;
  isDraft: boolean;
  scheduledAt: string | null;
}
function ChapterList({ bookId }: { bookId: number }) {
  const resource = useApiResource<{ chapters: Chapter[] }>(
    `/authors/me/books/${bookId}`,
  );
  return (
    <section
      aria-label="Book chapters"
      className="mt-5 border-t border-base-300 pt-5"
    >
      {resource.loading ? (
        <p role="status">Loading chapters…</p>
      ) : resource.error ? (
        <div role="alert">
          <p>{resource.error}</p>
          <button className="btn mt-3" onClick={resource.reload}>
            Retry chapters
          </button>
        </div>
      ) : resource.data?.chapters.length ? (
        <ol className="space-y-3">
          {[...resource.data.chapters]
            .sort((a, b) => a.index - b.index)
            .map((chapter) => (
              <li
                key={chapter.id}
                className="flex flex-wrap justify-between items-center gap-3 rounded-lg bg-base-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {chapter.index}. {chapter.title}
                  </p>
                  <p className="text-sm">
                    {chapter.isDraft
                      ? "Draft"
                      : chapter.scheduledAt
                        ? "Scheduled release"
                        : "Published"}
                  </p>
                </div>
                <Link
                  className="btn btn-sm"
                  to={`/author/comic/${bookId}/chapter/${chapter.id}/edit`}
                >
                  Edit chapter {chapter.index}
                </Link>
              </li>
            ))}
        </ol>
      ) : (
        <p>No chapters yet. Start with a draft.</p>
      )}
    </section>
  );
}
export default function AuthorDashboardPage() {
  const [params, setParams] = useSearchParams(),
    [expanded, setExpanded] = useState<number | null>(null),
    [query, setQuery] = useState(params.get("query") ?? "");
  const rawPage = Number(params.get("page") ?? 1),
    page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    status = params.get("status") ?? "";
  const resource = useApiResource<{
    items: OwnedBook[];
    total: number;
    page: number;
    limit: number;
  }>(
    `/authors/me/books?${new URLSearchParams({ query: params.get("query") ?? "", status, page: String(page), limit: "12" })}`,
  );
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setExpanded(null);
    setParams(next);
  }
  function search(e: FormEvent) {
    e.preventDefault();
    update({ query: query.trim(), page: "1" });
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-base-200 px-4 py-8 md:py-12"
    >
      <div className="mx-auto max-w-6xl space-y-7">
        <AuthorNavigation />
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">
              Writing workspace
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">Your stories</h1>
            <p className="mt-2">
              Write chapters, shape your drafts, and choose when to publish.
            </p>
          </div>
          <Link to="/author/comic/create" className="btn btn-primary">
            Create a book
          </Link>
        </div>
        <AuthorStats />
        <form
          onSubmit={search}
          role="search"
          aria-label="Your story search"
          className="card bg-base-100 p-5 flex-row flex-wrap items-end gap-4"
        >
          <label className="flex-1 min-w-44">
            Search your stories
            <input
              className="input input-bordered w-full mt-1"
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Publication status
            <select
              aria-label="Publication status"
              className="select select-bordered block mt-1"
              value={status}
              onChange={(e) => update({ status: e.target.value, page: "1" })}
            >
              <option value="">All stories</option>
              <option value="DRAFT">Drafts</option>
              <option value="PUBLISHED">Published</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </label>
          <button className="btn btn-primary">Search your stories</button>
        </form>
        {resource.loading ? (
          <p role="status">Loading your stories…</p>
        ) : resource.error ? (
          <div role="alert" className="alert alert-error">
            <p>{resource.error}</p>
            <button className="btn" onClick={resource.reload}>
              Retry stories
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm">
              {resource.data?.total ?? 0} matching stories
            </p>
            {!resource.data?.items.length ? (
              <section className="card bg-base-100 p-8">
                <h2 className="text-xl font-semibold">
                  {params.get("query") || status
                    ? "No stories match these filters."
                    : "Your next story starts here."}
                </h2>
                <p className="mt-2">
                  {params.get("query") || status
                    ? "Try another search or publication status."
                    : "Create a book, then start a text chapter. Illustrations are always optional."}
                </p>
              </section>
            ) : (
              resource.data.items.map((book) => (
                <article key={book.id} className="card bg-base-100 p-5 sm:p-6">
                  <div className="flex items-start gap-5">
                    {book.coverUrl && (
                      <img
                        src={book.coverUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="hidden sm:block w-20 h-28 object-cover rounded-md"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold">{book.title}</h2>
                      <p className="mt-2">
                        {book.status === "DRAFT"
                          ? "Draft"
                          : book.status === "HIDDEN"
                            ? "Hidden"
                            : "Published"}{" "}
                        ·{" "}
                        {book.visibility === "PUBLIC"
                          ? "Public"
                          : book.visibility === "MEMBERS"
                            ? "Members"
                            : "Required tier"}
                      </p>
                      <p className="text-sm mt-2">
                        {book.totalAllChapters} chapters ·{" "}
                        {book.totalPublishedChapters} published
                      </p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Link
                          className="btn btn-sm btn-primary"
                          to={`/author/comic/${book.id}/chapter/create`}
                        >
                          Write a chapter
                        </Link>
                        <Link
                          className="btn btn-sm"
                          to={`/author/comic/${book.id}/edit`}
                        >
                          Edit book
                        </Link>
                        <button
                          className="btn btn-sm"
                          aria-expanded={expanded === book.id}
                          onClick={() =>
                            setExpanded(expanded === book.id ? null : book.id)
                          }
                        >
                          Chapters
                        </button>
                        {book.status === "PUBLISHED" && (
                          <Link
                            className="btn btn-sm btn-ghost"
                            to={`/comic/${book.slug}`}
                          >
                            Reader preview
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                  {expanded === book.id && <ChapterList bookId={book.id} />}
                </article>
              ))
            )}
            {resource.data && resource.data.total > 12 && (
              <nav
                aria-label="Your story pages"
                className="flex flex-wrap items-center gap-3"
              >
                <button
                  className="btn"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous page
                </button>
                <span>
                  Page {page} of {Math.ceil(resource.data.total / 12)}
                </span>
                <button
                  className="btn"
                  disabled={page * 12 >= resource.data.total}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Next page
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
