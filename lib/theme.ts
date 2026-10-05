export type Theme = "light" | "dark";

const THEME_KEY = "mobility-theme";
const THEME_EVENT = "mobility-theme-change";

export function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
}

export function subscribeToTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;

  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Keep the current page themed even when browser storage is unavailable.
  }

  window.dispatchEvent(new Event(THEME_EVENT));
  window.setTimeout(() => root.classList.remove("theme-transition"), 200);
}

export function toggleTheme(): void {
  setTheme(getThemeSnapshot() === "dark" ? "light" : "dark");
}
