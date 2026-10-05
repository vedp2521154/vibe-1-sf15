"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { BusFront, LogOut, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import { getSessionSnapshot, logoutUser, parseSessionUser, subscribeToSession } from "@/lib/session";
import { getRoleHome, getRoleLabel, isAdmin, isRider } from "@/lib/types";
import type { SessionUser } from "@/lib/types";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
  const user: SessionUser | null = parseSessionUser(session);

  if (pathname === "/login" || !user) return null;

  const links =
    isAdmin(user.role, user.category)
      ? [{ href: "/admin", label: "Admin Dashboard" }, { href: "/admin/users", label: "Users" }, { href: "/admin/settings", label: "Settings" }]
      : isRider(user.role, user.category)
      ? [{ href: "/rider", label: "Dashboard" }]
      : [{ href: "/request", label: "Request Ride" }];
  links.push({ href: "/history", label: "History" });
  links.push({ href: "/notifications", label: "Notifications" });

  async function handleLogout() {
    await logoutUser();
    setMenuOpen(false);
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link href={getRoleHome(user.role, user.category)} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 focus-visible:ring-offset-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mobility-600 text-white">
            <BusFront aria-hidden="true" className="size-5" />
          </span>
          <span className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
            Internal Mobility Desk
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 focus-visible:ring-offset-2 ${
                pathname === link.href
                  ? "bg-mobility-50 text-mobility-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-3 flex items-center gap-2 border-l border-slate-200 pl-4">
            <NotificationBell />
            <ThemeToggle />
            <div className="text-right leading-tight">
              <p className="max-w-40 truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="mt-1 text-xs text-slate-500">{getRoleLabel(user.role, user.category, user.roleName)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 focus-visible:ring-offset-2"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <span className="hidden max-w-28 truncate text-xs font-medium text-slate-600 sm:block">{user.name}</span>
          <NotificationBell />
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 focus-visible:ring-offset-2"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:px-2">
            <div className="mb-2 border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="mt-1 text-xs text-slate-500">{getRoleLabel(user.role, user.category, user.roleName)}</p>
            </div>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 ${
                  pathname === link.href ? "bg-mobility-50 text-mobility-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
