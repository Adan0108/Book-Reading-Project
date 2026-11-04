import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import AuthLayout from "../../features/account/AuthLayout";
export default function SignUp() {
  const signUp = useAuthStore((s) => s.signUp),
    busy = useAuthStore((s) => s.isSigningUp),
    navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    if (await signUp(email)) navigate("/OTP");
  }
  return (
    <AuthLayout
      title="Create your account"
      description="We’ll send you a verification code before you choose a password."
    >
      <form onSubmit={submit} className="space-y-5">
        <label htmlFor="email" className="block">
          Email
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
          className="btn btn-primary w-full"
          disabled={busy}
        >
          {busy ? "Sending…" : "Continue"}
        </button>
      </form>
      <p>
        Already have an account?{" "}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
