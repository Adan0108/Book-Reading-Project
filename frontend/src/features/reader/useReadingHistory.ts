import { useEffect, useRef, useState } from "react";
import api from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
/** Progress is private navigation metadata; it never grants content access or drives financial totals. */
export function useReadingHistory(
  chapterId: number | undefined,
  progress: number,
) {
  const userId = useAuthStore((s) => s.authUser?.id),
    last = useRef(""),
    [state, setState] = useState<{ chapterId: number; text: string } | null>(
      null,
    );
  useEffect(() => {
    if (!chapterId || !userId) return;
    const percentage = Math.round(Math.max(0, Math.min(1, progress)) * 100),
      identity = `${userId}:${chapterId}:${percentage}`;
    if (last.current === identity) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api
        .post(
          "/library/history",
          { chapterId, progress: percentage },
          { signal: controller.signal },
        )
        .then(() => {
          if (!controller.signal.aborted) {
            last.current = identity;
            setState({
              chapterId,
              text: "Progress saved to your reading history.",
            });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setState({
              chapterId,
              text: "History sync unavailable. Reading can continue.",
            });
        });
    }, 1500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [chapterId, progress, userId]);
  return userId && state && state.chapterId === chapterId ? state.text : "";
}
