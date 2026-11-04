import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthLayout from "../features/account/AuthLayout";
export default function LoginPage() {
  const [show, setShow] = useState(false),
    login = useAuthStore((s) => s.login),
    busy = useAuthStore((s) => s.isLoggingIn),
    navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    if (
      await login(String(values.get("email")), String(values.get("password")))
    )
      navigate("/");
  }
  return (
    <AuthLayout
      title="Sign in to HiBook"
      description="Continue reading, write your next chapter, or connect with your members."
    >
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <label className="block" htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input input-bordered w-full mt-1"
            />
          </label>
          <div>
            <label className="block" htmlFor="password">
              Password
            </label>
            <div className="flex gap-2 mt-1">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                className="input input-bordered w-full min-w-0"
              />
              <button
                type="button"
                className="btn"
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <Link className="link inline-block" to="/forgot/email">
            Forgot Password?
          </Link>
          <button type="submit" className="btn btn-primary w-full">
            {busy ? "Signing In…" : "Sign In"}
          </button>
        </fieldset>
      </form>
      <p>
        New to HiBook?{" "}
        <Link className="link" to="/signup">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
