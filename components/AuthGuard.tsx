"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSessionSnapshot, isSessionLoaded, loadServerSession, parseSessionUser, subscribeToSession } from "@/lib/session";
import { getRoleHome, type RoleCategory } from "@/lib/types";

interface AuthGuardProps { children: ReactNode; allowedFor?: RoleCategory }
function subscribeToNothing(): () => void { return () => {}; }

export default function AuthGuard({ children, allowedFor }: AuthGuardProps) {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const [loading, setLoading] = useState(() => !isSessionLoaded());
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const user = parseSessionUser(session);
  const authorized = hydrated && !loading && Boolean(user) && (!allowedFor || user?.category === allowedFor);

  useEffect(() => {
    let active = true;
    void loadServerSession().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated || loading) return;
    if (!user) { router.replace("/login"); return; }
    if (allowedFor && user.category !== allowedFor) router.replace(getRoleHome(user.role, user.category));
  }, [allowedFor, hydrated, loading, router, user]);

  if (!authorized) return <main className="flex flex-1 items-center justify-center px-6 py-16"><p className="text-sm font-medium text-slate-500" role="status">Checking your session…</p></main>;
  return <>{children}</>;
}
