import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import api from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
import { message } from "../author/images";
export function useAccessCheck(endpoint: string, role?: string) {
  // Saved UID selects a probe; only a verified API response can permit the outlet.
  const identity = useAuthStore(
      (s) =>
        s.authUser?.id || Number(localStorage.getItem("userId")) || undefined,
    ),
    [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    identity: number;
    attempt: number;
    allowed: boolean;
    error: string;
    status?: number;
  } | null>(null);
  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    api
      .get(endpoint, { signal: controller.signal, timeout: 30000 })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          const allowed = !role || data.metadata.roles?.includes(role);
          setSnapshot({
            identity,
            attempt,
            allowed,
            error: allowed
              ? ""
              : "This account does not have access to this page.",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setSnapshot({
            identity,
            attempt,
            allowed: false,
            error: message(error),
            status: isAxiosError(error) ? error.response?.status : undefined,
          });
      });
    return () => controller.abort();
  }, [identity, attempt, endpoint, role]);
  const current =
    snapshot?.identity === identity && snapshot?.attempt === attempt
      ? snapshot
      : null;
  return {
    hasIdentity: Boolean(identity),
    allowed: Boolean(identity && current?.allowed),
    loading: Boolean(identity && !current),
    error: identity
      ? (current?.error ?? "")
      : "Sign in to access your account.",
    status: current?.status,
    retry: () => setAttempt((a) => a + 1),
  };
}
