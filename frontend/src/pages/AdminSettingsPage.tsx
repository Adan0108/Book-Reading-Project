import { useEffect, useState } from "react";
import AdminLayout from "../features/admin/AdminLayout";
import { useAdminResource } from "../features/admin/useAdminResource";
import api from "../lib/axios";
import { message } from "../features/author/images";
interface Policy {
  reportsEnabled: boolean;
  reportsPerDay: number;
  version: number;
}
export default function AdminSettingsPage() {
  const resource = useAdminResource<Policy>("/admin/moderation-policy"),
    [policy, setPolicy] = useState<Policy | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (resource.data) setPolicy(resource.data);
  }, [resource.data]);
  async function save() {
    if (!policy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.put("/admin/moderation-policy", {
        ...policy,
        reason,
      });
      setPolicy(data.metadata);
      setReason("");
      setStatus("Moderation settings saved and audited.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminLayout title="Moderation settings">
      {(error || resource.error) && (
        <p role="alert" className="alert alert-error">
          {error || resource.error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {resource.loading || !policy ? (
        <p>Loading settings…</p>
      ) : (
        <form
          className="card bg-base-100 p-6 max-w-xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex gap-3 items-center">
            <input
              className="checkbox"
              type="checkbox"
              checked={policy.reportsEnabled}
              onChange={(e) =>
                setPolicy({ ...policy, reportsEnabled: e.target.checked })
              }
            />
            Content reports enabled
          </label>
          <label className="block">
            Reports per account per day
            <input
              className="input input-bordered block mt-2"
              type="number"
              min={1}
              max={20}
              required
              value={policy.reportsPerDay}
              onChange={(e) =>
                setPolicy({ ...policy, reportsPerDay: Number(e.target.value) })
              }
            />
          </label>
          <label className="block">
            Change reason
            <textarea
              className="textarea textarea-bordered w-full mt-2"
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Save moderation settings
          </button>
        </form>
      )}
      <button className="btn" onClick={resource.reload}>
        Reload settings
      </button>
    </AdminLayout>
  );
}
