import AdminLayout from "../features/admin/AdminLayout";
import { useApiResource } from "../lib/useApiResource";
import { money } from "../lib/money";
interface Reconciliation {
  totals: {
    payments: number;
    grossCents: number;
    refundedCents: number;
    platformCents: number;
    authorCents: number;
  };
  note: string;
  unconfirmedExpired: {
    id: string;
    kind: string;
    cents: number;
    currency: string;
  }[];
}
export default function AdminReconciliationPage() {
  const resource = useApiResource<Reconciliation>(
      "/admin/payments/reconciliation",
    ),
    data = resource.data;
  return (
    <AdminLayout title="Sandbox billing reconciliation">
      <p>
        Compare these records with the provider sandbox. This screen does not
        create charges, refunds or payouts.
      </p>
      {resource.error && <p role="alert">{resource.error}</p>}
      {resource.loading ? (
        <p>Loading ledger…</p>
      ) : (
        data && (
          <>
            <div className="card bg-base-100 p-6 space-y-2">
              <p>{data.totals.payments} recorded payments</p>
              <p>Gross: {money(Number(data.totals.grossCents))}</p>
              <p>Refunds: {money(Number(data.totals.refundedCents))}</p>
              <p>
                Platform after refunds:{" "}
                {money(Number(data.totals.platformCents))}
              </p>
              <p>
                Authors after refunds: {money(Number(data.totals.authorCents))}
              </p>
            </div>
            <p>{data.note}</p>
            <h2 className="text-xl font-bold">Expired unconfirmed quotes</h2>
            {!data.unconfirmedExpired.length ? (
              <p>No candidates for review.</p>
            ) : (
              data.unconfirmedExpired.map((row) => (
                <article
                  className="card bg-base-100 p-4 break-words"
                  key={row.id}
                >
                  <p>
                    {row.kind} · {money(row.cents, row.currency)}
                  </p>
                  <p className="text-sm">{row.id}</p>
                </article>
              ))
            )}
          </>
        )
      )}
      <button className="btn" onClick={resource.reload}>
        Refresh reconciliation
      </button>
    </AdminLayout>
  );
}
