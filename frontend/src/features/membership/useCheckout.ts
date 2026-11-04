import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import api from "../../lib/axios";
import { message } from "../author/images";

export interface BillingConfiguration {
  configured: boolean;
  provider: string;
  mode: "sandbox" | "fixture";
  currency: string;
}
export function useCheckout() {
  const [configuration, setConfiguration] =
      useState<BillingConfiguration | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const attempt = useRef<{ payload: string; requestId: string } | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    api
      .get("/payments/configuration")
      .then(({ data }) => {
        if (active) setConfiguration(data.metadata);
      })
      .catch((e: unknown) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function checkout(
    payload:
      | { kind: "MEMBERSHIP"; authorId: number; tierId: number }
      | { kind: "DONATION"; authorId: number; amountCents: number },
  ) {
    if (submitting.current) return;
    const serialized = JSON.stringify(payload);
    if (!attempt.current || attempt.current.payload !== serialized)
      attempt.current = { payload: serialized, requestId: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/payments/checkout", {
        ...payload,
        requestId: attempt.current.requestId,
      });
      window.location.assign(data.metadata.url);
    } catch (e) {
      if (
        isAxiosError(e) &&
        e.response &&
        e.response.status >= 400 &&
        e.response.status < 500
      )
        attempt.current = null;
      setError(message(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return { configuration, busy, error, checkout };
}
