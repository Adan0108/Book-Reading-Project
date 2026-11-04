import AdminLayout from "../features/admin/AdminLayout";
import { useAdminResource } from "../features/admin/useAdminResource";
import { money } from "../lib/money";
export default function AdminDashboardPage() {
  const resource = useAdminResource<Record<string, number>>("/admin/dashboard");
  const stats = resource.data;
  return (
    <AdminLayout title="Administration">
      <p>
        Recorded platform activity. Financial totals are sandbox ledger records,
        not live revenue or payouts.
      </p>
      {resource.error && (
        <p role="alert" className="alert alert-error">
          {resource.error}
        </p>
      )}
      {resource.loading ? (
        <p role="status">Loading statistics…</p>
      ) : (
        stats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Users", stats.totalUsers],
              ["Active approved authors", stats.totalAuthors],
              ["Visible published books", stats.publishedBooks],
              ["Visible released chapters", stats.publishedChapters],
              ["Recorded book views", stats.recordedBookViews],
              ["Eligible memberships", stats.activeMemberships],
              ["Open reports", stats.openReports],
              [
                "Sandbox donations after refunds",
                money(stats.sandboxDonationCents),
              ],
            ].map(([label, value]) => (
              <article key={label} className="card bg-base-100 p-6">
                <h2>{label}</h2>
                <p className="font-bold text-2xl mt-3">{value}</p>
              </article>
            ))}
          </div>
        )
      )}
      <button className="btn" onClick={resource.reload}>
        Refresh statistics
      </button>
    </AdminLayout>
  );
}
