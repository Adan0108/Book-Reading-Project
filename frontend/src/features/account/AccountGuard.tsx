import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import api from "../../lib/axios";
import { message } from "../author/images";
import { useAuthStore } from "../../store/useAuthStore";

export default function AccountGuard({ role }: { role?: string }) {
  const accountId = useAuthStore((s) => s.authUser?.id),
    [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Checking account access…");
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    setAllowed(false);
    setStatus("Checking account access…");
    if (!accountId && !localStorage.getItem("userId")) {
      setStatus("Sign in to access your account.");
      return;
    }
    api
      .get("/user/me")
      .then(({ data }) => {
        if (!active) return;
        const hasRole = !role || data.metadata.roles?.includes(role);
        setAllowed(hasRole);
        setStatus(
          hasRole ? "" : "This account does not have access to this page.",
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setAllowed(false);
          setStatus(message(error));
        }
      });
    return () => {
      active = false;
    };
  }, [role, accountId, attempt]);
  if (allowed && (accountId || localStorage.getItem("userId")))
    return <Outlet />;
  return (
    <main className="max-w-xl mx-auto p-8">
      <p role="status">
        {!accountId && !localStorage.getItem("userId")
          ? "Sign in to access your account."
          : status}
      </p>
      <div className="flex flex-wrap gap-3 mt-4">
        <Link className="btn" to="/login">
          Sign in
        </Link>
        <Link className="btn" to="/">
          Browse stories
        </Link>
        <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
          Retry account access
        </button>
      </div>
    </main>
  );
}
