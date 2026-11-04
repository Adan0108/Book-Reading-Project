import { useEffect, useState } from "react";
import OtpInput from "react-otp-input";
export function PasswordField({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="block">
        {label}
      </label>
      <div className="flex gap-2 mt-1">
        <input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
          className="input input-bordered w-full min-w-0"
        />
        <button
          type="button"
          className="btn"
          aria-label={`${show ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={show}
          onClick={() => setShow(!show)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
export function VerificationCode({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Verification code">
      <OtpInput
        value={value}
        onChange={onChange}
        numInputs={6}
        inputType="tel"
        shouldAutoFocus
        containerStyle={{
          display: "flex",
          gap: ".5rem",
          justifyContent: "center",
        }}
        inputStyle={{ width: "2.25rem", height: "3rem" }}
        renderInput={(props, index) => (
          <input
            {...props}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            disabled={disabled}
            aria-label={`Verification code digit ${index + 1}`}
            className="input input-bordered p-0 text-center"
          />
        )}
      />
    </div>
  );
}
export function ResendCode({
  busy,
  onResend,
}: {
  busy: boolean;
  onResend: () => Promise<void>;
}) {
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    if (!seconds) return;
    const timeout = setTimeout(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearTimeout(timeout);
  }, [seconds]);
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {seconds
          ? `You can request another code in ${seconds} seconds.`
          : "Didn’t receive a code? Check your spam folder or request another."}
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={seconds > 0 || busy}
        onClick={async () => {
          await onResend();
          setSeconds(60);
        }}
      >
        {busy ? "Sending…" : "Resend code"}
      </button>
    </div>
  );
}
