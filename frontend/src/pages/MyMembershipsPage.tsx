import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import type { Membership } from "../features/membership/types";

export default function MyMembershipsPage() {
  const [items, setItems] = useState<Membership[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null),
    [status, setStatus] = useState("");
  async function cancel(id: number) {
    setBusy(id);
    setError("");
    setStatus("");
    try {
      await api.post(`/memberships/${id}/cancel`);
      const { data } = await api.get("/memberships/me");
      setItems(data.metadata.items);
      setStatus(
        "Renewal canceled. Access continues until the current period ends.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }
  useEffect(() => {
    api
      .get("/memberships/me")
      .then(({ data }) => setItems(data.metadata.items))
      .catch((e: unknown) => setError(message(e)));
  }, []);
  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to="/">← HiBook</Link>
        <h1 className="text-3xl font-bold">My memberships</h1>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {items === null ? (
          <p role="status">Loading memberships…</p>
        ) : !items.length ? (
          <p>You have no memberships yet. Explore authors and their plans.</p>
        ) : (
          items.map((m) => (
            <article key={m.id} className="card bg-base-100 p-6 space-y-3">
              <h2 className="text-xl font-bold">
                <Link to={`/author/${m.authorId}`}>
                  {m.authorName || "Author"}
                </Link>{" "}
                · {m.tierName}
              </h2>
              <p>
                {m.hasAccess ? "Active access" : m.status} ·{" "}
                {m.autoRenew ? "Renews" : "Ends"}{" "}
                {new Date(m.currentPeriodEnd).toLocaleDateString()}
              </p>
              <Link to={`/author/${m.authorId}/memberships`} className="link">
                View plans
              </Link>
              {m.autoRenew && !["CANCELED", "EXPIRED"].includes(m.status) && (
                <button
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => cancel(m.id)}
                >
                  {busy === m.id ? "Canceling…" : "Cancel renewal"}
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </main>
  );
}
