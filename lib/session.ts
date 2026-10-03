import { isUserRole, type SessionUser } from "@/lib/types";

const SESSION_KEY = "mobility-desk-user";
const SESSION_EVENT = "mobility-desk-session-change";

export function subscribeToSession(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_EVENT, callback);
  };
}

export function getSessionSnapshot(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function parseSessionUser(storedUser: string | null): SessionUser | null {
  if (!storedUser) return null;

  try {
    const parsed: unknown = JSON.parse(storedUser);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("name" in parsed) ||
      typeof parsed.name !== "string" ||
      !parsed.name.trim() ||
      !("role" in parsed) ||
      !isUserRole(parsed.role)
    ) {
      return null;
    }

    return { name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

export function saveUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getUser(): SessionUser | null {
  return parseSessionUser(getSessionSnapshot());
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}
