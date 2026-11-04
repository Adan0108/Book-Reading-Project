import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../lib/axios";
import { message } from "../features/author/images";
import { money } from "../lib/money";
import type {
  AuthorTier,
  MembershipPolicy,
} from "../features/membership/types";

function TierForm({
  level,
  tier,
  legacy,
  policy,
  onSaved,
}: {
  level: 1 | 2;
  tier?: AuthorTier;
  legacy: AuthorTier[];
  policy: MembershipPolicy;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget),
      existing = String(data.get("existingTierId") ?? "");
    try {
      await api.put(`/authors/me/tiers/${level}`, {
        name: data.get("name"),
        description: data.get("description"),
        benefits: String(data.get("benefits"))
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        available: data.has("available"),
        ...(existing ? { existingTierId: Number(existing) } : {}),
      });
      await onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="card bg-base-100 shadow-sm p-6 space-y-4"
      aria-label={`Tier ${level} settings`}
    >
      <h2 className="text-xl font-bold">
        Tier {level} ·{" "}
        {money(level === 1 ? policy.tierOneCents : policy.tierTwoCents)} / month
      </h2>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      <fieldset
        disabled={busy || (level === 2 && !policy.tierTwoEnabled)}
        className="space-y-4"
      >
        {!tier && legacy.length > 0 && (
          <label className="block">
            Use an existing tier
            <select
              aria-label="Use an existing tier"
              name="existingTierId"
              className="select select-bordered w-full"
            >
              <option value="">Create a new tier</option>
              {legacy.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          Tier name
          <input
            name="name"
            className="input input-bordered w-full"
            required
            maxLength={80}
            defaultValue={
              tier?.name ??
              (level === 1 ? policy.tierOneName : policy.tierTwoName)
            }
          />
        </label>
        <label className="block">
          Description
          <textarea
            aria-label="Description"
            name="description"
            className="textarea textarea-bordered w-full"
            maxLength={2000}
            defaultValue={tier?.description ?? ""}
          />
        </label>
        <label className="block">
          Benefits, one per line
          <textarea
            aria-label="Benefits, one per line"
            name="benefits"
            className="textarea textarea-bordered w-full"
            rows={4}
            defaultValue={tier?.benefits.join("\n") ?? ""}
          />
        </label>
        <label className="flex gap-3 items-center">
          <input
            type="checkbox"
            name="available"
            className="checkbox"
            defaultChecked={tier?.available ?? true}
          />
          Available to new members
        </label>
        <p className="text-sm opacity-70">
          Turning this off stops new subscriptions. Existing paid access
          continues until its period ends.
        </p>
        <button type="submit" className="btn btn-primary">
          {busy ? "Saving…" : `Save tier ${level}`}
        </button>
      </fieldset>
      {level === 2 && !policy.tierTwoEnabled && (
        <p>The platform currently offers one tier per author.</p>
      )}
    </form>
  );
}
interface MemberRow {
  id: number;
  userId: number;
  username: string;
  tierName: string;
  status: string;
  currentPeriodEnd: string;
  hasAccess: boolean;
}
export default function AuthorMembershipsPage() {
  const [data, setData] = useState<{
      authorId: number;
      tiers: AuthorTier[];
      policy: MembershipPolicy;
    } | null>(null),
    [members, setMembers] = useState<{
      items: MemberRow[];
      total: number;
      active: number;
    } | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  async function load() {
    const [tiers, result] = await Promise.all([
      api.get("/authors/me/tiers"),
      api.get("/authors/me/members"),
    ]);
    setData(tiers.data.metadata);
    setMembers(result.data.metadata);
  }
  useEffect(() => {
    load().catch((e: unknown) => setError(message(e)));
  }, []);
  return (
    <main className="min-h-screen bg-base-200 p-5 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <nav className="flex gap-4 flex-wrap">
          <Link to="/author/dashboard">← My books</Link>
          <Link to="/author/posts">Author posts</Link>
          {data && (
            <Link to={`/author/${data.authorId}/memberships`}>
              Preview membership plans
            </Link>
          )}
        </nav>
        <h1 className="text-3xl font-bold">Memberships</h1>
        <p>
          Offer one or two monthly tiers. Memberships support your work and
          grant access only to your content.
        </p>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {!data ? (
          <p role="status">Loading membership settings…</p>
        ) : (
          <>
            <p>
              Platform share: {data.policy.revenueShareBps / 100}%. Prices
              follow the current platform policy.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {([1, 2] as const).map((level) => (
                <TierForm
                  key={`${level}-${data.tiers.find((t) => t.level === level)?.id ?? "new"}`}
                  level={level}
                  tier={data.tiers.find((t) => t.level === level)}
                  legacy={data.tiers.filter((t) => t.level === null)}
                  policy={data.policy}
                  onSaved={async () => {
                    await load();
                    setStatus(`Tier ${level} saved.`);
                  }}
                />
              ))}
            </div>
            <section className="card bg-base-100 p-6 space-y-4">
              <h2 className="text-xl font-bold">Your members</h2>
              <p>
                {members?.active ?? 0} active subscriptions ·{" "}
                {members?.total ?? 0} subscription records
              </p>
              {!members?.items.length ? (
                <p>No members yet. Your plans are ready to share.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Reader</th>
                        <th>Tier</th>
                        <th>Status</th>
                        <th>Access ends</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.items.map((m) => (
                        <tr key={m.id}>
                          <td>{m.username || `Reader ${m.userId}`}</td>
                          <td>{m.tierName}</td>
                          <td>{m.hasAccess ? "Active" : m.status}</td>
                          <td>
                            {new Date(m.currentPeriodEnd).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
