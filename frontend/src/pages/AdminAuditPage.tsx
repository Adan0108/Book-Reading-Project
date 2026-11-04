import { useSearchParams } from "react-router-dom";
import AdminLayout from "../features/admin/AdminLayout";
import { useAdminResource } from "../features/admin/useAdminResource";
interface Audit {
  id: number;
  action: string;
  target: string;
  details: unknown;
  createdEpoch: number;
}
export default function AdminAuditPage() {
  const [params, setParams] = useSearchParams(),
    resource = useAdminResource<{ items: Audit[]; nextCursor: number | null }>(
      `/admin/audit?${params}`,
    );
  return (
    <AdminLayout title="Administrative audit trail">
      <p>
        Recorded moderation and configuration changes. This is a read-only
        record.
      </p>
      {resource.error && <p role="alert">{resource.error}</p>}
      {resource.loading ? (
        <p>Loading audit…</p>
      ) : (
        resource.data?.items.map((row) => (
          <details key={row.id} className="card bg-base-100 p-5">
            <summary className="cursor-pointer">
              {row.action} · {row.target} ·{" "}
              {new Date(row.createdEpoch * 1000).toLocaleString()}
            </summary>
            <pre className="whitespace-pre-wrap break-words text-sm mt-4">
              {JSON.stringify(row.details, null, 2)}
            </pre>
          </details>
        ))
      )}
      <button className="btn" onClick={resource.reload}>
        Refresh audit
      </button>
      {resource.data?.nextCursor && (
        <button
          className="btn"
          onClick={() =>
            setParams({ cursor: String(resource.data!.nextCursor) })
          }
        >
          Older records
        </button>
      )}
    </AdminLayout>
  );
}
