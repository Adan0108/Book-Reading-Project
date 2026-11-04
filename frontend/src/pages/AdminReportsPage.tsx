import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminLayout from "../features/admin/AdminLayout";
import { useApiResource } from "../lib/useApiResource";
import api from "../lib/axios";
import { message } from "../features/author/images";
interface Report {
  id: number;
  kind: string;
  resourceId: number;
  reason: string;
  status: string;
  resolution: string | null;
  version: number;
}
export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams(),
    filter = params.get("status") ?? "OPEN",
    resource = useApiResource<{ items: Report[]; nextCursor: number | null }>(
      `/admin/reports?${new URLSearchParams({ ...Object.fromEntries(params), status: filter })}`,
    );
  const [selected, setSelected] = useState<Report | null>(null),
    [next, setNext] = useState("REVIEWING"),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function review() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/reports/${selected.id}`, {
        version: selected.version,
        status: next,
        reason,
      });
      setSelected(null);
      setStatus(
        "Report review recorded. Content visibility is managed separately.",
      );
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminLayout title="Content reports">
      <label>
        Queue status
        <select
          aria-label="Queue status"
          className="select select-bordered ml-3"
          value={filter}
          onChange={(e) => {
            setSelected(null);
            setParams({ status: e.target.value });
          }}
        >
          {["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {(error || resource.error) && (
        <p role="alert" className="alert alert-error">
          {error || resource.error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {resource.loading ? (
        <p>Loading reports…</p>
      ) : !resource.data?.items.length ? (
        <p>No reports in this queue.</p>
      ) : (
        resource.data.items.map((r) => (
          <article className="card bg-base-100 p-6 space-y-3" key={r.id}>
            <h2 className="font-bold">
              Report {r.id} · {r.kind} {r.resourceId}
            </h2>
            <p className="whitespace-pre-wrap break-words">{r.reason}</p>
            {r.resolution && <p>Review: {r.resolution}</p>}
            <Link
              className="link"
              to={`/admin/content?kind=${r.kind}&query=${r.resourceId}`}
            >
              Review reported content
            </Link>
            {!["RESOLVED", "DISMISSED"].includes(r.status) && (
              <button
                className="btn w-fit"
                onClick={() => {
                  setSelected(r);
                  setNext("REVIEWING");
                  setReason("");
                }}
              >
                Review report
              </button>
            )}
          </article>
        ))
      )}
      {selected && (
        <form
          aria-label="Report review"
          className="card bg-base-100 p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void review();
          }}
        >
          <h2 className="font-bold">Review report {selected.id}</h2>
          <label>
            Review status
            <select
              aria-label="Review status"
              className="select select-bordered block mt-2"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            >
              {["REVIEWING", "RESOLVED", "DISMISSED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Review reason
            <textarea
              aria-label="Review reason"
              required
              maxLength={2000}
              className="textarea textarea-bordered w-full mt-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Save report review
          </button>
        </form>
      )}
      <div className="flex gap-3">
        <button className="btn" onClick={resource.reload}>
          Reload reports
        </button>
        {resource.data?.nextCursor && (
          <button
            className="btn"
            onClick={() =>
              setParams({
                status: filter,
                cursor: String(resource.data!.nextCursor),
              })
            }
          >
            Older reports
          </button>
        )}
      </div>
    </AdminLayout>
  );
}
