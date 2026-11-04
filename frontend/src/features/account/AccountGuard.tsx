import { Link, Outlet } from "react-router-dom";
import { useAccessCheck } from "./useAccessCheck";
export default function AccountGuard({ role }: { role?: string }) {
  const check = useAccessCheck("/user/me", role);
  if (check.allowed) return <Outlet />;
  return (
    <main id="main-content" tabIndex={-1} className="max-w-xl mx-auto p-8">
      <p role="status">
        {check.loading ? "Checking account access…" : check.error}
      </p>
      {!check.loading && (
        <div className="flex flex-wrap gap-3 mt-4">
          <Link className="btn" to="/login">
            Sign in
          </Link>
          <Link className="btn" to="/">
            Browse stories
          </Link>
          <button className="btn" onClick={check.retry}>
            Retry account access
          </button>
        </div>
      )}
    </main>
  );
}
