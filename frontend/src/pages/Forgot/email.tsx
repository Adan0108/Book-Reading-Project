import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import AuthLayout from "../../features/account/AuthLayout";
export default function ForgotEmailPage() {
  const forgot = useAuthStore((s) => s.forgotPassword),
    busy = useAuthStore((s) => s.isRequestingReset),
    navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (await forgot(String(new FormData(e.currentTarget).get("email") ?? "")))
      navigate("/forgot/changePassword");
  }
  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email to request a password reset code."
    >
      <form onSubmit={submit} className="space-y-5">
        <label htmlFor="email" className="block">
          Email Address
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={busy}
            className="input input-bordered w-full mt-1"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Sending…" : "Send reset code"}
        </button>
      </form>
      <Link className="link" to="/login">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
