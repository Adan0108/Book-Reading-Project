import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { isAxiosError } from "axios";
import api from "../../lib/axios";
import { message } from "./images";
import { useAuthStore } from "../../store/useAuthStore";

export default function AuthorGuard() {
  const accountId = useAuthStore((s) => s.authUser?.id);
  const [state, setState] = useState<"loading" | "allowed" | "failed">(
    "loading",
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState("loading");
    if (!accountId && !localStorage.getItem("userId")) {
      setError("Sign in with an approved author account to open the studio.");
      setState("failed");
      return;
    }
    api
      .get("/authors/me/books", { params: { limit: 1 }, timeout: 30000 })
      .then(() => {
        if (active) setState("allowed");
      })
      .catch((e: unknown) => {
        if (active) {
          setError(
            isAxiosError(e) && e.response?.status === 403
              ? "An author account is required to publish books."
              : message(e),
          );
          setState("failed");
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, accountId]);
  if (state === "allowed" && (accountId || localStorage.getItem("userId")))
    return <Outlet />;
  return (
    <main className="max-w-2xl mx-auto p-8 pt-24">
      {state === "loading" ? (
        <p role="status">Checking author access…</p>
      ) : (
        <>
          <p role="alert">{error}</p>
          <Link to="/login" className="btn">
            Sign in
          </Link>
          <Link to="/account/author-application" className="btn">
            Apply to become an author
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Retry
          </button>
        </>
      )}
    </main>
  );
}
