import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
import { message } from "../author/images";
export default function ReportContent({
  kind,
  resourceId,
}: {
  kind: "BOOK" | "CHAPTER" | "POST";
  resourceId: number;
}) {
  const user = useAuthStore((s) => s.authUser),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api.post("/reports", { kind, resourceId, reason });
      setStatus("Your report was received for review.");
      setOpen(false);
      setReason("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Report content" className="text-sm mt-5 space-y-3">
      <button
        className="btn btn-ghost btn-sm"
        disabled={busy || Boolean(status)}
        onClick={() => setOpen((v) => !v)}
      >
        Report this {kind.toLowerCase()}
      </button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {open &&
        (user ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="block">
              Report reason
              <textarea
                aria-label="Report reason"
                required
                maxLength={2000}
                className="textarea textarea-bordered w-full mt-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className="btn btn-sm" disabled={busy}>
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </form>
        ) : (
          <p>
            <Link className="link" to="/login">
              Sign in to report content
            </Link>
          </p>
        ))}
    </section>
  );
}
