import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Header from "./HomePage/Header";
import { useApiResource } from "../lib/useApiResource";
import api from "../lib/axios";
import { message } from "../features/author/images";
interface Entry {
  id: number;
  bookId?: number;
  title?: string;
  slug?: string | null;
  authorName?: string | null;
  authorId?: number;
  penName?: string;
  chapterId?: number;
  chapterNo?: number | null;
  progress?: number;
  lastReadAt?: string;
  available: boolean;
}
export default function LibraryPage() {
  const [params, setParams] = useSearchParams(),
    tab = ["bookmarks", "history", "follows"].includes(params.get("tab") ?? "")
      ? params.get("tab")!
      : "bookmarks";
  const resource = useApiResource<{
      items: Entry[];
      nextCursor: string | number | null;
    }>(
      `/library/${tab}?${new URLSearchParams({ ...(params.get("cursor") ? { cursor: params.get("cursor")! } : {}) })}`,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null),
    [status, setStatus] = useState("");
  async function remove(entry: Entry) {
    setBusy(entry.id);
    setError("");
    try {
      if (tab === "bookmarks")
        await api.put(`/library/bookmarks/${entry.bookId}`, {
          bookmarked: false,
        });
      else if (tab === "follows")
        await api.put(`/authors/${entry.authorId}/follow`, { followed: false });
      else await api.delete(`/library/history/${entry.chapterId}`);
      setStatus(
        tab === "follows" ? "Author unfollowed." : "Library entry removed.",
      );
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="min-h-screen bg-base-200">
      <Header />
      <main
        id="main-content"
        className="max-w-4xl mx-auto p-4 md:p-10 space-y-6"
      >
        <h1 className="text-3xl font-bold">My library</h1>
        <p>
          Your bookmarks, reading history and followed authors. History syncs
          while you read when signed in.
        </p>
        <nav aria-label="Library sections" className="flex flex-wrap gap-3">
          {[
            ["bookmarks", "Bookmarks"],
            ["history", "Reading history"],
            ["follows", "Following"],
          ].map(([key, label]) => (
            <Link
              key={key}
              className={`btn ${tab === key ? "btn-primary" : ""}`}
              aria-current={tab === key ? "page" : undefined}
              to={`/account/library?tab=${key}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {(error || resource.error) && (
          <p role="alert" className="alert alert-error">
            {error || resource.error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {resource.loading ? (
          <p role="status">Loading library…</p>
        ) : !resource.data?.items.length ? (
          <div className="card bg-base-100 p-8 space-y-4">
            <p>No entries in this section yet.</p>
            <Link className="link" to="/">
              Discover a story
            </Link>
          </div>
        ) : (
          resource.data.items.map((entry) => (
            <article className="card bg-base-100 p-6 space-y-3" key={entry.id}>
              <h2 className="text-xl font-bold">
                {entry.available ? (
                  <Link
                    className="link"
                    to={
                      tab === "follows"
                        ? `/author/${entry.authorId}`
                        : `/comic/${entry.slug}`
                    }
                  >
                    {entry.penName || entry.title}
                  </Link>
                ) : (
                  entry.penName || entry.title
                )}
              </h2>
              {entry.authorName && <p>By {entry.authorName}</p>}
              {tab === "history" && (
                <>
                  <p>
                    Chapter {entry.chapterNo ?? "unavailable"} ·{" "}
                    {entry.progress}% reading progress
                  </p>
                  <p className="text-sm">
                    {entry.lastReadAt
                      ? new Date(entry.lastReadAt).toLocaleString()
                      : ""}
                  </p>
                  {entry.available && (
                    <Link
                      className="btn w-fit"
                      to={`/comic/${entry.slug}/chapters/${entry.chapterNo}?resume=${entry.progress}`}
                    >
                      Continue reading
                    </Link>
                  )}
                </>
              )}
              {!entry.available && (
                <p>
                  This content is currently unavailable. You can still remove
                  the saved entry.
                </p>
              )}
              <button
                className="btn btn-sm w-fit"
                disabled={busy !== null}
                onClick={() => void remove(entry)}
              >
                {tab === "follows"
                  ? "Unfollow author"
                  : tab === "history"
                    ? "Remove history entry"
                    : "Remove bookmark"}
              </button>
            </article>
          ))
        )}
        <div className="flex gap-3">
          <button className="btn" onClick={resource.reload}>
            Refresh library
          </button>
          {resource.data?.nextCursor && (
            <button
              className="btn"
              onClick={() =>
                setParams({ tab, cursor: String(resource.data!.nextCursor) })
              }
            >
              Older entries
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
