import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../features/admin/AdminLayout";
import { useAdminResource } from "../features/admin/useAdminResource";
import api from "../lib/axios";
import { message } from "../features/author/images";
interface Account {
  id: number;
  email: string;
  username: string;
  state: number;
  penName: string;
  roles: string[];
  setupComplete: boolean;
}
export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams(),
    role = params.get("role") === "AUTHOR" ? "AUTHOR" : "";
  const resource = useAdminResource<{
      items: Account[];
      nextCursor: number | null;
    }>(`/admin/users?${params}`),
    [query, setQuery] = useState(params.get("query") ?? ""),
    [selected, setSelected] = useState<Account | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/users/${selected.id}/state`, {
        active: selected.state !== 1,
        expectedState: selected.state,
        reason,
      });
      setSelected(null);
      setReason("");
      setStatus("Account state updated. Suspended sessions have been revoked.");
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminLayout title={role ? "Author accounts" : "Accounts"}>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ ...(role ? { role } : {}), query });
        }}
      >
        <label>
          Search accounts
          <input
            className="input input-bordered ml-3"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="btn">Search</button>
      </form>
      {(error || resource.error) && (
        <p role="alert" className="alert alert-error">
          {error || resource.error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {resource.loading ? (
        <p>Loading accounts…</p>
      ) : !resource.data?.items.length ? (
        <p>No matching accounts.</p>
      ) : (
        <div role="region" aria-label="Account table" tabIndex={0} className="overflow-x-auto card bg-base-100 focus-visible:outline-2 focus-visible:outline-primary">
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Roles</th>
                <th>State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.username || u.penName || "Account"}
                    <br />
                    {u.email}
                  </td>
                  <td>{u.roles.join(", ") || "No role"}</td>
                  <td>
                    {!u.setupComplete
                      ? "Setup pending"
                      : u.state === 1
                        ? "Active"
                        : "Suspended"}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      disabled={!u.setupComplete}
                      onClick={() => {
                        setSelected(u);
                        setReason("");
                        setStatus("");
                      }}
                    >
                      {u.state === 1 ? "Suspend" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <form
          aria-label="Account moderation"
          className="card bg-base-100 p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 className="font-bold">
            {selected.state === 1 ? "Suspend" : "Restore"} {selected.email}
          </h2>
          <p>
            Suspension revokes sessions and blocks the account's author content
            and member chat. Restoring requires a fresh login.
          </p>
          <label className="block">
            Action reason
            <textarea
              aria-label="Action reason"
              className="textarea textarea-bordered w-full mt-2"
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button className="btn btn-primary" disabled={busy}>
              Confirm account action
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setSelected(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="flex gap-3">
        <button className="btn" onClick={resource.reload}>
          Reload accounts
        </button>
        {resource.data?.nextCursor && (
          <button
            className="btn"
            onClick={() =>
              setParams({
                ...Object.fromEntries(params),
                cursor: String(resource.data!.nextCursor),
              })
            }
          >
            Older accounts
          </button>
        )}
      </div>
    </AdminLayout>
  );
}
