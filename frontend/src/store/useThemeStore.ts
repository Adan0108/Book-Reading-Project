import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeState } from "../type/store";
function applyTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggleTheme: () => {
        const isDark = !get().isDark;
        set({ isDark });
        applyTheme(isDark);
      },
      setTheme: (isDark) => {
        set({ isDark });
        applyTheme(isDark);
      },
    }),
    {
      name: "theme-storage",
      onRehydrateStorage: () => (state) => applyTheme(state?.isDark ?? false),
    },
  ),
);
