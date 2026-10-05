"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { getRoleCategory, getRoleHome, type RoleCategory, type UserRole } from "@/lib/types";

interface AuthGuardProps {
  children: ReactNode;
  allowedFor?: UserRole | RoleCategory;
}

function subscribeToNothing(): () => void {
  return () => {};
}

function isAllowed(role: UserRole, allowedFor?: UserRole | RoleCategory): boolean {
  if (!allowedFor) return true;
  if (allowedFor === "REQUESTER") return getRoleCategory(role) === "REQUESTER";
  if (allowedFor === "RIDER" || allowedFor === "ADMIN") return getRoleCategory(role) === allowedFor;
  return role === allowedFor;
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
  const authorized = hasHydrated && userRole !== undefined && isAllowed(userRole, allowedFor);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!userRole) {
      router.replace("/login");
      return;
    }

    if (!isAllowed(userRole, allowedFor)) {
      router.replace(getRoleHome(userRole));
    }
  }, [allowedFor, hasHydrated, router, userRole]);

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
