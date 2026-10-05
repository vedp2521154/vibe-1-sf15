import { isRoleCategory, isUserRole, type SessionUser } from "@/lib/types";

const SESSION_EVENT = "mobility-desk-session-change";
let sessionValue: string | null = null;
let sessionLoaded = false;
let loadPromise: Promise<SessionUser | null> | null = null;

function notifySessionChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EVENT));
}

export function subscribeToSession(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_EVENT, callback);
  return () => window.removeEventListener(SESSION_EVENT, callback);
}

export function getSessionSnapshot(): string | null {
  return sessionValue;
}

export function parseSessionUser(storedUser: string | null): SessionUser | null {
  if (!storedUser) return null;
  try {
    const parsed: unknown = JSON.parse(storedUser);
    if (typeof parsed !== "object" || parsed === null || !("name" in parsed) || typeof parsed.name !== "string" || !("role" in parsed) || !isUserRole(parsed.role) || !("category" in parsed) || !isRoleCategory(parsed.category)) return null;
    const roleName = "roleName" in parsed && typeof parsed.roleName === "string" ? parsed.roleName : parsed.role;
    const username = "username" in parsed && typeof parsed.username === "string" ? parsed.username : "";
    const id = "id" in parsed && typeof parsed.id === "string" ? parsed.id : "";
    return { name: parsed.name, role: parsed.role, category: parsed.category, roleName, username, id };
  } catch { return null; }
}

export function saveUser(user: SessionUser): void {
  sessionValue = JSON.stringify(user);
  sessionLoaded = true;
  notifySessionChange();
}

export function getUser(): SessionUser | null {
  return parseSessionUser(sessionValue);
}

export function isSessionLoaded(): boolean {
  return sessionLoaded;
}

export function loadServerSession(force = false): Promise<SessionUser | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!force && sessionLoaded) return Promise.resolve(getUser());
  if (!force && loadPromise) return loadPromise;
  loadPromise = fetch("/api/auth/me", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return null;
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || !("user" in result)) return null;
      return parseSessionUser(JSON.stringify(result.user));
    })
    .catch(() => null)
    .then((user) => {
      sessionValue = user ? JSON.stringify(user) : null;
      sessionLoaded = true;
      notifySessionChange();
      return user;
    })
    .finally(() => { loadPromise = null; });
  return loadPromise;
}

export async function logoutUser(): Promise<void> {
  try { await fetch("/api/auth/logout", { method: "POST" }); }
  catch { /* Clear local UI state even when the network is unavailable. */ }
  finally {
    sessionValue = null;
    sessionLoaded = true;
    notifySessionChange();
  }
}
