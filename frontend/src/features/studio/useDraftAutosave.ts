import { useEffect, useRef } from "react";

export function useDraftAutosave(
  save: () => Promise<void>,
  enabled: boolean,
  revision: string,
) {
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  }, [save]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void latest.current();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [enabled, revision]);
}
