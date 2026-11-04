import { useEffect, useState } from "react";

const key = "hibook.reader.preferences.v1";
export function useReaderPreferences(defaultDark: boolean) {
  const [preferences, setPreferences] = useState<{
    theme: "light" | "dark";
    fontSize: number;
  }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        saved &&
        ["light", "dark"].includes(saved.theme) &&
        Number.isFinite(saved.fontSize)
      )
        return {
          theme: saved.theme,
          fontSize: Math.max(16, Math.min(28, saved.fontSize)),
        };
    } catch {
      /* Optional browser storage. */
    }
    return { theme: defaultDark ? "dark" : "light", fontSize: 20 };
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch {
      /* Reading works without storage. */
    }
  }, [preferences]);
  return { preferences, setPreferences };
}
