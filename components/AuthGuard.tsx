"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { getRoleCategory, getRoleHome, type RoleCategory } from "@/lib/types";

interface AuthGuardProps {
  children: ReactNode;
  allowedFor?: RoleCategory;
}

function subscribeToNothing(): () => void {
  return () => {};
}

function isAllowed(role: string, category: RoleCategory, allowedFor?: RoleCategory): boolean {
  if (!allowedFor) return true;
  return getRoleCategory(role, category) === allowedFor;
}

export default function AuthGuard({ children, allowedFor }: AuthGuardProps) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
  const hasHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const user = parseSessionUser(session);
  const userRole = user?.role;
  const userCategory = user?.category;
  const authorized = hasHydrated && userRole !== undefined && userCategory !== undefined && isAllowed(userRole, userCategory, allowedFor);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!userRole) {
      router.replace("/login");
      return;
    }

    if (userCategory && !isAllowed(userRole, userCategory, allowedFor)) {
      router.replace(getRoleHome(userRole, userCategory));
    }
  }, [allowedFor, hasHydrated, router, userCategory, userRole]);

  if (!authorized) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-sm font-medium text-slate-500" role="status">
          Checking your session…
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
