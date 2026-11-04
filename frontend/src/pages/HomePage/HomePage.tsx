import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StoryCard from "../../features/catalog/StoryCard";
import type { StorySummary } from "../../features/catalog/types";
import api from "../../lib/axios";
import { message } from "../../features/author/images";
interface Catalog {
  items: StorySummary[];
  total: number;
  page: number;
  limit: number;
}
export default function HomePage() {
  const [params, setParams] = useSearchParams(),
    [result, setResult] = useState<Catalog | null>(null),
    [filters, setFilters] = useState<{
      genres: string[];
      tags: { slug: string; name: string }[];
    }>({ genres: [], tags: [] }),
    [error, setError] = useState(""),
    [filterError, setFilterError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [query, setQuery] = useState(params.get("query") ?? "");
  useEffect(() => {
    setQuery(params.get("query") ?? "");
  }, [params]);
  useEffect(() => {
    let active = true;
    setFilterError("");
    void api
      .get("/discovery/filters")
      .then(({ data }) => {
        if (active) setFilters(data.metadata);
      })
      .catch(() => {
        if (active)
          setFilterError("Genre and tag filters are temporarily unavailable.");
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api
      .get("/books", {
        params: {
          query: params.get("query") || undefined,
          genre: params.get("genre") || undefined,
          tag: params.get("tag") || undefined,
          sort: params.get("sort") || "recent",
          page: params.get("page") || "1",
          limit: 12,
        },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult(data.metadata);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError(message(e));
          setResult(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [params, retry]);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  return (
    <div className="min-h-screen bg-base-200">
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 py-10 space-y-8"
      >
        <header className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            HiBook · Light novels
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Find your next chapter.
          </h1>
          <p className="text-lg leading-8 opacity-80">
            Read original stories, follow their authors, and support the work
            you want to see continue.
          </p>
        </header>
        <form
          role="search"
          aria-label="Story discovery"
          className="card bg-base-100 p-5 grid md:grid-cols-[minmax(10rem,2fr)_1fr_1fr_1fr_auto] gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            filter("query", query);
          }}
        >
          <label>
            Title or author
            <input
              aria-label="Title or author"
              className="input input-bordered w-full mt-2"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Genre
            <select
              aria-label="Genre filter"
              className="select select-bordered w-full mt-2"
              value={params.get("genre") ?? ""}
              onChange={(e) => filter("genre", e.target.value)}
            >
              <option value="">All genres</option>
              {filters.genres.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select
              aria-label="Tag filter"
              className="select select-bordered w-full mt-2"
              value={params.get("tag") ?? ""}
              onChange={(e) => filter("tag", e.target.value)}
            >
              <option value="">All tags</option>
              {filters.tags.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order
            <select
              aria-label="Story order"
              className="select select-bordered w-full mt-2"
              value={params.get("sort") ?? "recent"}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="recent">Newest stories</option>
              <option value="updated">Recently updated</option>
              <option value="popular">Most read</option>
            </select>
          </label>
          <button className="btn btn-primary self-end">Search stories</button>
        </form>
        {filterError && (
          <div role="alert" className="alert">
            <span>{filterError}</span>
            <button
              className="btn btn-sm"
              onClick={() => setRetry((v) => v + 1)}
            >
              Retry filters
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
            <button
              className="btn btn-sm"
              onClick={() => setRetry((v) => v + 1)}
            >
              Retry catalog
            </button>
          </div>
        )}
        {loading ? (
          <div
            role="status"
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            aria-label="Loading stories"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-80 rounded-xl" />
            ))}
          </div>
        ) : result && !result.items.length ? (
          <p className="card bg-base-100 p-8">
            No published stories match these filters. Try another title, author
            or genre.
          </p>
        ) : (
          result && (
            <>
              <p>{result.total} matching stories</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {result.items.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
              <nav
                aria-label="Story pages"
                className="flex flex-wrap items-center gap-4"
              >
                <button
                  className="btn"
                  disabled={result.page <= 1}
                  onClick={() =>
                    setParams({
                      ...Object.fromEntries(params),
                      page: String(result.page - 1),
                    })
                  }
                >
                  Previous page
                </button>
                <span>
                  Page {result.page} of{" "}
                  {Math.max(1, Math.ceil(result.total / result.limit))}
                </span>
                <button
                  className="btn"
                  disabled={result.page * result.limit >= result.total}
                  onClick={() =>
                    setParams({
                      ...Object.fromEntries(params),
                      page: String(result.page + 1),
                    })
                  }
                >
                  Next page
                </button>
              </nav>
            </>
          )
        )}
        <footer className="border-t border-base-300 pt-6 text-sm opacity-70">
          HiBook · Original stories, one chapter at a time.
        </footer>
      </main>
    </div>
  );
}
