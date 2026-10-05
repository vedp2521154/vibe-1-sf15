"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";

interface UserNotification {
  id: string; title: string; message: string; read: boolean; createdAt: string;
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const result = await response.json() as { notifications?: UserNotification[]; unreadCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Notifications are unavailable.");
      setNotifications(result.notifications ?? []); setUnreadCount(result.unreadCount ?? 0); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Notifications are unavailable."); }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 45_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    function closeOutside(event: MouseEvent) { if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false); }
    function closeEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", closeOutside); document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, []);

  async function markRead(id?: string) {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id, read: true } : { markAllRead: true }) });
      if (!response.ok) throw new Error("Could not update notifications.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notifications."); }
  }

  return <div className="relative" ref={panelRef}>
    <button type="button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-controls="notification-panel" onClick={() => setOpen((value) => !value)} className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-mobility-600">
      <Bell aria-hidden="true" className="size-[1.125rem]" />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <div id="notification-panel" role="region" aria-label="Recent notifications" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-bold">Notifications</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div>{unreadCount > 0 && <button type="button" onClick={() => void markRead()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-mobility-700 hover:bg-mobility-50"><CheckCheck aria-hidden="true" className="size-4" /> Mark all read</button>}</div>
      {error ? <p className="px-4 py-4 text-sm text-rose-700" role="alert">{error}</p> : notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-500">You’re all caught up.</p> : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{notifications.slice(0, 6).map((notification) => <li key={notification.id} className={`flex gap-3 px-4 py-3 ${notification.read ? "bg-white" : "bg-mobility-50/60"}`}><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{notification.title}</p><p className="mt-0.5 break-words text-xs leading-5 text-slate-600">{notification.message}</p><time className="mt-1 block text-[11px] text-slate-500" dateTime={notification.createdAt}>{relativeTime(notification.createdAt)}</time></div>{!notification.read && <button type="button" aria-label={`Mark ${notification.title} as read`} onClick={() => void markRead(notification.id)} className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-mobility-700 hover:bg-mobility-100"><Check aria-hidden="true" className="size-4" /></button>}</li>)}</ul>}
      <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-mobility-700 hover:bg-slate-50">View all notifications</Link>
    </div>}
  </div>;
}
