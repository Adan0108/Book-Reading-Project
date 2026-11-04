import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../../store/useAuthStore";
import AuthLayout from "../../features/account/AuthLayout";
import { PasswordField } from "../../features/account/AuthFields";
export default function Password() {
  const setup = useAuthStore((s) => s.setupPassword),
    busy = useAuthStore((s) => s.isSettingUpPassword),
    email = useAuthStore((s) => s.emailToVerify),
    proof = useAuthStore((s) => s.setupToken),
    navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    if (data.get("password") !== data.get("confirm-password"))
      return toast.error("Passwords do not match.");
    if (await setup(String(data.get("username")), String(data.get("password"))))
      navigate("/login");
  }
  if (!email || !proof)
    return (
      <AuthLayout
        title="Verify your email first"
        description="Verification stays in this tab for a short time. Start again if you reloaded or your code expired."
      >
        <Link to="/signup" className="btn btn-primary">
          Restart verification
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout
      title="Finish your account"
      description={`Your email is verified: ${email}. Choose a username and a password of at least 12 characters.`}
    >
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <label htmlFor="username" className="block">
            Username
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              maxLength={50}
              className="input input-bordered w-full mt-1"
            />
          </label>
          <PasswordField label="Password" name="password" />
          <PasswordField label="Confirm Password" name="confirm-password" />
          <button type="submit" className="btn btn-primary w-full">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </fieldset>
      </form>
      <Link to="/signup" className="link">
        Use another email
      </Link>
    </AuthLayout>
  );
}
