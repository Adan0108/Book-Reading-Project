import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../../store/useAuthStore";
import AuthLayout from "../../features/account/AuthLayout";
import {
  PasswordField,
  VerificationCode,
  ResendCode,
} from "../../features/account/AuthFields";
export default function ForgotPasswordPage() {
  const [otp, setOtp] = useState(""),
    reset = useAuthStore((s) => s.resetPassword),
    busy = useAuthStore((s) => s.isResettingPassword),
    email = useAuthStore((s) => s.emailToVerify),
    resend = useAuthStore((s) => s.resendPasswordReset),
    resending = useAuthStore((s) => s.isResendingReset),
    navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    if (otp.length !== 6) return toast.error("Enter the six-digit code.");
    if (data.get("password") !== data.get("confirm-password"))
      return toast.error("Passwords do not match.");
    if (await reset(otp, String(data.get("password")))) navigate("/login");
    else setOtp("");
  }
  if (!email)
    return (
      <AuthLayout
        title="Request a reset code"
        description="Enter your account email before choosing a new password."
      >
        <Link to="/forgot/email" className="btn btn-primary">
          Request code
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout
      title="Choose a new password"
      description={`Enter the reset code sent to ${email}. A successful reset signs out all existing sessions.`}
    >
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <VerificationCode value={otp} onChange={setOtp} disabled={busy} />
          <p className="text-sm">Use at least 12 characters.</p>
          <PasswordField label="New Password" name="password" />
          <PasswordField label="Confirm New Password" name="confirm-password" />
          <button type="submit" className="btn btn-primary w-full">
            {busy ? "Resetting…" : "Reset password"}
          </button>
        </fieldset>
      </form>
      <ResendCode busy={busy || resending} onResend={resend} />
      <Link to="/forgot/email" className="link">
        Use another email
      </Link>
    </AuthLayout>
  );
}
