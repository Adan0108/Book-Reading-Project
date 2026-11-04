import { Link, Outlet } from "react-router-dom";
import { useAccessCheck } from "../account/useAccessCheck";
export default function AuthorGuard() {
  const check = useAccessCheck("/authors/me/profile");
  if (check.allowed) return <Outlet />;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="max-w-2xl mx-auto p-8 pt-16"
    >
      {check.loading ? (
        <p role="status">Checking author access…</p>
      ) : (
        <>
          <p role="alert">
            {!check.hasIdentity
              ? "Sign in with an approved author account to open the studio."
              : check.status === 403
                ? "An author account is required to publish books."
                : check.error}
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link to="/login" className="btn">
              Sign in
            </Link>
            <Link to="/account/author-application" className="btn">
              Apply to become an author
            </Link>
            <button type="button" className="btn" onClick={check.retry}>
              Retry
            </button>
          </div>
        </>
      )}
    </main>
  );
}
