import { useCallback, useEffect, useState } from "react";
import api from "./axios";
import { message } from "../features/author/images";
/** Abort stale reads and never show another endpoint's data under the current view. */
export function useApiResource<T>(endpoint: string) {
  const [snapshot, setSnapshot] = useState<{
      endpoint: string;
      value: T;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api
      .get(endpoint, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setSnapshot({ endpoint, value: data.metadata });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, version]);
  return {
    data: snapshot?.endpoint === endpoint ? snapshot.value : null,
    error,
    loading,
    reload,
  };
}
