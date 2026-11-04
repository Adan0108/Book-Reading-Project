import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import { money } from "../lib/money";

interface Payment {
  id: number;
  kind: string;
  authorId: number;
  authorName: string;
  grossCents: number;
  refundedCents: number;
  platformCents: number;
  authorCents: number;
  currency: string;
  createdAt: string;
}
interface History {
  items: Payment[];
  nextCursor: number | null;
  totals: { netCents: number; authorCents: number; donationCents: number };
}
export default function PaymentHistoryPage({
  author = false,
}: {
  author?: boolean;
}) {
  const [params] = useSearchParams(),
    checkout = params.get("checkout");
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState(""),
    [state, setState] = useState("");
  const endpoint = author ? "/authors/me/payments" : "/payments/me";
  async function load(cursor?: number) {
    try {
      const { data } = await api.get(endpoint, {
        params: cursor ? { cursor } : undefined,
      });
      setHistory(data.metadata);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    let active = true;
    api
      .get(endpoint)
      .then(({ data }) => {
        if (active) setHistory(data.metadata);
      })
      .catch((e: unknown) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [endpoint]);
  useEffect(() => {
    if (!checkout || author) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>,
      tries = 0;
    async function poll() {
      try {
        const { data } = await api.get(`/payments/checkout/${checkout}`);
        if (!active) return;
        setState(data.metadata.state);
        if (
          ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
            data.metadata.state,
          )
        ) {
          const response = await api.get(endpoint);
          if (active) setHistory(response.data.metadata);
        } else if (data.metadata.state === "PENDING" && ++tries < 12)
          timer = setTimeout(() => void poll(), 2500);
      } catch (e) {
        if (active) setError(message(e));
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkout, author, endpoint]);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-base-200 p-6"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="flex gap-5">
          <Link to={author ? "/author/dashboard" : "/"}>
            ← {author ? "Author dashboard" : "HiBook"}
          </Link>
          <Link to="/account/memberships">My memberships</Link>
        </nav>
        <h1 className="text-3xl font-bold">
          {author ? "Author income" : "Payment history"}
        </h1>
        <p>
          Sandbox records only. Provider fees and author payouts are not
          included.
        </p>
        {state && (
          <p role="status">
            {state === "REFUNDED"
              ? "Payment refunded. Membership access depends on remaining paid periods."
              : state === "PARTIALLY_REFUNDED"
                ? "Payment partially refunded. See the recorded amounts below."
                : state === "PAID"
                  ? "Payment confirmed by verified webhook."
                  : state === "EXPIRED"
                    ? "Checkout expired. No access was granted by returning here."
                    : "Waiting for verified payment confirmation. You may return later."}
          </p>
        )}
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {history === null ? (
          <p role="status">Loading payments…</p>
        ) : (
          <>
            <div className="card bg-base-100 p-6">
              <p>
                {author ? "Author earnings" : "Total paid after refunds"}:{" "}
                {money(
                  Number(
                    author
                      ? history.totals.authorCents
                      : history.totals.netCents,
                  ),
                  "USD",
                )}
              </p>
              <p>
                Donations after refunds:{" "}
                {money(Number(history.totals.donationCents), "USD")}
              </p>
            </div>
            {!history.items.length ? (
              <p>No payments recorded.</p>
            ) : (
              history.items.map((p) => (
                <article key={p.id} className="card bg-base-100 p-6 space-y-2">
                  <h2 className="font-bold">
                    {p.kind === "DONATION" ? "Donation" : "Membership"} ·{" "}
                    {p.authorName || "Author"}
                  </h2>
                  <p>
                    {money(p.grossCents, p.currency)} ·{" "}
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                  {p.refundedCents > 0 && (
                    <p>Refunded: {money(p.refundedCents, p.currency)}</p>
                  )}
                  {author && (
                    <p>
                      Platform: {money(p.platformCents, p.currency)} · Author:{" "}
                      {money(p.authorCents, p.currency)}
                    </p>
                  )}
                </article>
              ))
            )}
            <div className="flex gap-4">
              <button className="btn" onClick={() => void load()}>
                Refresh history
              </button>
              {history.nextCursor && (
                <button
                  className="btn"
                  onClick={() => void load(history.nextCursor!)}
                >
                  Older payments
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
