import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
import { message } from "../author/images";
interface LibraryState {
  bookmarked: boolean;
  lastRead: { chapterNo: number; progress: number } | null;
}
export default function SaveStoryButton({
  bookId,
  slug,
}: {
  bookId: number;
  slug: string;
}) {
  const userId = useAuthStore((s) => s.authUser?.id),
    [state, setState] = useState<LibraryState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setState(null);
    api
      .get(`/library/books/${bookId}`)
      .then(({ data }) => {
        if (active) {
          setState(data.metadata);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [bookId, userId, retry]);
  async function toggle() {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.put(`/library/bookmarks/${bookId}`, {
        bookmarked: !state.bookmarked,
      });
      setState({ ...state, bookmarked: !state.bookmarked });
      setStatus(
        state.bookmarked ? "Bookmark removed." : "Saved to your library.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!userId)
    return (
      <Link className="btn" to="/login">
        Sign in to save this story
      </Link>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          className="btn"
          disabled={busy || !state}
          onClick={() => void toggle()}
        >
          {state?.bookmarked ? "Remove bookmark" : "Save to library"}
        </button>
        {state?.lastRead && (
          <Link
            className="btn"
            to={`/comic/${slug}/chapters/${state.lastRead.chapterNo}?resume=${state.lastRead.progress}`}
          >
            Continue chapter {state.lastRead.chapterNo}
          </Link>
        )}
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="link" onClick={() => setRetry((v) => v + 1)}>
            Retry library state
          </button>
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
