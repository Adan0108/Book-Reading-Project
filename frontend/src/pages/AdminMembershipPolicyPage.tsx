import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../lib/axios";
import { decimalCents } from "../lib/money";
import { message } from "../features/author/images";
import type { MembershipPolicy } from "../features/membership/types";

export default function AdminMembershipPolicyPage() {
  const [policy, setPolicy] = useState<MembershipPolicy | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  async function load() {
    const { data } = await api.get("/membership-policy");
    setPolicy(data.metadata);
  }
  useEffect(() => {
    load().catch((e: unknown) => setError(message(e)));
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !policy) return;
    setBusy(true);
    setError("");
    setStatus("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.put("/admin/membership-policy", {
        version: policy.version,
        currency: "USD",
        tierOneName: data.get("tierOneName"),
        tierTwoName: data.get("tierTwoName"),
        tierOneCents: decimalCents(String(data.get("tierOnePrice"))),
        tierTwoCents: decimalCents(String(data.get("tierTwoPrice"))),
        tierTwoEnabled: data.has("tierTwoEnabled"),
        revenueShareBps: decimalCents(String(data.get("sharePercent"))),
      });
      setPolicy(result.data.metadata);
      setStatus("Membership policy saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-base-200 p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <Link to="/admin">← Administration</Link>
        <h1 className="text-3xl font-bold">Membership policy</h1>
        <p>
          Configure monthly USD prices for new checkout sessions and the
          platform revenue share. Existing provider subscriptions keep their
          contracted price.
        </p>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {!policy ? (
          <p role="status">Loading pricing policy…</p>
        ) : (
          <form
            key={policy.version}
            onSubmit={save}
            className="card bg-base-100 p-6 space-y-4"
          >
            <fieldset disabled={busy} className="space-y-4">
              <label className="block">
                First tier default name
                <input
                  name="tierOneName"
                  defaultValue={policy.tierOneName}
                  required
                  maxLength={80}
                  className="input input-bordered w-full"
                />
              </label>
              <label className="block">
                First tier monthly price (USD)
                <input
                  name="tierOnePrice"
                  type="number"
                  step="0.01"
                  min="1"
                  max="10000"
                  defaultValue={(policy.tierOneCents / 100).toFixed(2)}
                  required
                  className="input input-bordered w-full"
                />
              </label>
              <label className="block">
                Second tier default name
                <input
                  name="tierTwoName"
                  defaultValue={policy.tierTwoName}
                  required
                  maxLength={80}
                  className="input input-bordered w-full"
                />
              </label>
              <label className="block">
                Second tier monthly price (USD)
                <input
                  name="tierTwoPrice"
                  type="number"
                  step="0.01"
                  min="1"
                  max="10000"
                  defaultValue={(policy.tierTwoCents / 100).toFixed(2)}
                  required
                  className="input input-bordered w-full"
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="tierTwoEnabled"
                  defaultChecked={policy.tierTwoEnabled}
                  className="checkbox"
                />
                Allow a second tier
              </label>
              <label className="block">
                Platform share (%)
                <input
                  name="sharePercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={(policy.revenueShareBps / 100).toFixed(2)}
                  required
                  className="input input-bordered w-full"
                />
              </label>
              <button type="submit" className="btn btn-primary">
                {busy ? "Saving…" : "Save membership policy"}
              </button>
              <button
                type="button"
                className="btn ml-2"
                onClick={() => load().catch((e) => setError(message(e)))}
              >
                Reload current policy
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </main>
  );
}
