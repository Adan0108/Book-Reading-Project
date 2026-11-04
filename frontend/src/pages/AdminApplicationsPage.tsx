import { useEffect, useState } from "react";
import AdminLayout from "../features/admin/AdminLayout";
import api from "../lib/axios";
import { message } from "../features/author/images";

interface Application {
  id: number;
  applicationTitle: string;
  status: string;
  userId: number;
}
interface Detail {
  id: number;
  status: string;
  sample_title: string;
  sample_story: string;
  pen_name: string;
  motivation: string;
}
export default function AdminApplicationsPage() {
  const [items, setItems] = useState<Application[]>([]),
    [selected, setSelected] = useState<Detail | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  async function load() {
    const { data } = await api.get("/admin/author-applications", {
      params: { status: "PENDING", limit: 100 },
    });
    setItems(data.metadata.items);
  }
  useEffect(() => {
    load()
      .catch((e: unknown) => setError(message(e)))
      .finally(() => setLoading(false));
  }, []);
  async function inspect(id: number) {
    setError("");
    setSelected(null);
    setBusy(true);
    setReason("");
    try {
      const { data } = await api.get(`/admin/author-applications/${id}`);
      setSelected(data.metadata);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/author-applications/${selected!.id}/${action}`, {
        decisionReason: reason,
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminLayout title="Author applications">
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading applications…</p>
      ) : items.length === 0 ? (
        <p>No pending applications.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="border rounded-xl p-4 flex flex-wrap justify-between gap-4"
            >
              <span>
                {item.applicationTitle} · {item.status}
              </span>
              <button
                className="btn"
                disabled={busy}
                onClick={() => inspect(item.id)}
              >
                Review application {item.id}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <section
          className="border rounded-xl p-6 space-y-4"
          aria-label="Review application"
        >
          <h2 className="text-xl font-semibold">
            {selected.sample_title} — {selected.pen_name}
          </h2>
          <p className="whitespace-pre-wrap max-h-96 overflow-auto">
            {selected.sample_story}
          </p>
          <p>{selected.motivation}</p>
          <label className="block">
            Decision reason
            <textarea
              className="textarea textarea-bordered w-full"
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => decide("approve")}
            >
              Approve author
            </button>
            <button
              className="btn"
              disabled={busy || reason.trim().length < 3}
              onClick={() => decide("reject")}
            >
              Reject application
            </button>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
