import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import AuthLayout from "../../features/account/AuthLayout";
import {
  VerificationCode,
  ResendCode,
} from "../../features/account/AuthFields";
export default function OTP() {
  const [otp, setOtp] = useState(""),
    verify = useAuthStore((s) => s.verifyOtp),
    busy = useAuthStore((s) => s.isVerifying),
    email = useAuthStore((s) => s.emailToVerify),
    resend = useAuthStore((s) => s.resendOtp),
    resending = useAuthStore((s) => s.isResending),
    navigate = useNavigate();
  useEffect(() => {
    let active = true;
    if (otp.length === 6)
      void verify(otp).then((success) => {
        if (active) {
          if (success) navigate("/setPassword");
          else setOtp("");
        }
      });
    return () => {
      active = false;
    };
  }, [otp, verify, navigate]);
  if (!email)
    return (
      <AuthLayout
        title="Start with your email"
        description="Request a verification code to create your HiBook account."
      >
        <Link to="/signup" className="btn btn-primary">
          Enter email
        </Link>
      </AuthLayout>
    );
  return (
    <AuthLayout
      title="Verify your email"
      description={`Enter the six-digit code sent to ${email}.`}
    >
      <VerificationCode value={otp} onChange={setOtp} disabled={busy} />
      {busy && <p role="status">Verifying code…</p>}
      <ResendCode busy={resending || busy} onResend={resend} />
      <Link to="/signup" className="link">
        Use another email
      </Link>
    </AuthLayout>
  );
}
