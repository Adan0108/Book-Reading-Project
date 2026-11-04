import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import { money } from "../lib/money";
import type { AuthorTier } from "../features/membership/types";
import { useCheckout } from "../features/membership/useCheckout";

export default function AuthorPlansPage() {
  const { authorId } = useParams();
  const billing = useCheckout();
  const [tiers, setTiers] = useState<AuthorTier[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get(`/authors/${authorId}/tiers`)
      .then(({ data }) => {
        if (active) setTiers(data.metadata.tiers);
      })
      .catch((e: unknown) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [authorId]);
  return (
    <main className="min-h-screen bg-base-200 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <nav className="flex gap-5">
          <Link to={`/author/${authorId}`}>← Author profile</Link>
          <Link to={`/author/${authorId}/posts`}>Author posts</Link>
          <Link to="/account/memberships">My memberships</Link>
          <Link to={`/author/${authorId}/donate`}>Donate</Link>
        </nav>
        <h1 className="text-3xl font-bold">Support this author</h1>
        <p>
          A membership unlocks this author’s eligible stories and posts. It does
          not unlock other authors’ work. Higher tiers include lower-tier
          content.
        </p>
        {billing.error && <p role="alert" className="alert alert-error">{billing.error}</p>}
        <p>{billing.configuration?.mode === "fixture" ? "Payment test simulation. No real transaction." : "Sandbox checkout uses test payments only."}</p>
        {error ? (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        ) : tiers === null ? (
          <p role="status">Loading plans…</p>
        ) : !tiers.length ? (
          <p>This author is not offering memberships yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {tiers.map((t) => (
              <article key={t.id} className="card bg-base-100 p-6 space-y-4">
                <h2 className="text-2xl font-bold">{t.name}</h2>
                <p className="text-xl">
                  {money(t.priceCents, t.currency)} / month
                </p>
                <p>{t.description}</p>
                <ul className="list-disc pl-5 space-y-2">
                  {t.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <button className="btn btn-primary" disabled={billing.busy || !billing.configuration?.configured}
                  onClick={()=>billing.checkout({kind:"MEMBERSHIP",authorId:Number(authorId),tierId:t.id})}>
                  {billing.busy ? "Opening checkout…" : billing.configuration?.configured ? `Subscribe to ${t.name}` : "Subscriptions unavailable"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
