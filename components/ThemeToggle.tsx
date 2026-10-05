"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { getThemeSnapshot, subscribeToTheme, toggleTheme } from "@/lib/theme";

function getServerTheme(): "light" {
  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 focus-visible:ring-offset-2"
    >
      {isDark ? <Sun aria-hidden="true" className="size-[1.125rem]" /> : <Moon aria-hidden="true" className="size-[1.125rem]" />}
    </button>
  );
}
