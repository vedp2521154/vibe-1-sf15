"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import type { UserRole } from "@/lib/types";

interface AuthGuardProps {
  children: ReactNode;
  allowedFor?: UserRole | "requester";
}

function homeForRole(role: UserRole): string {
  return role === "rider" ? "/rider" : "/request";
}

function subscribeToNothing(): () => void {
  return () => {};
}

function isAllowed(role: UserRole, allowedFor?: UserRole | "requester"): boolean {
  if (!allowedFor) return true;
  if (allowedFor === "requester") return role === "student" || role === "employee";
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
      router.replace(homeForRole(userRole));
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
