"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";

interface UserNotification { id: string; title: string; message: string; read: boolean; createdAt: string; }

function NotificationsList() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const result = await response.json() as { notifications?: UserNotification[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not load notifications.");
    setNotifications((result.notifications ?? []).sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt)));
  }

  useEffect(() => {
    let active = true;
    const initialLoad = window.setTimeout(() => {
      load().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load notifications."); }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(initialLoad); };
  }, []);

  async function markRead(id: string) {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, read: true }) });
      if (!response.ok) throw new Error("Could not update this notification.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update this notification."); }
  }

  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
    <div className="mb-6 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-mobility-100 text-mobility-700"><Bell aria-hidden="true" className="size-5" /></span><div><p className="text-sm font-semibold text-mobility-800">Updates</p><h1 className="text-2xl font-bold tracking-tight text-slate-950">Notifications</h1></div></div>
    {error && <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
    {loading ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500" role="status">Loading notifications…</p> : notifications.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><Bell aria-hidden="true" className="mx-auto size-6 text-slate-400" /><h2 className="mt-3 font-semibold text-slate-900">No notifications yet</h2><p className="mt-1 text-sm text-slate-500">Ride updates will appear here.</p></div> : <ol className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{notifications.map((notification) => <li key={notification.id} className={`flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${notification.read ? "" : "bg-mobility-50/50"}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{notification.title}</h2>{!notification.read && <span className="rounded-full bg-mobility-100 px-2 py-0.5 text-[11px] font-bold text-mobility-800">New</span>}</div><p className="mt-1 break-words text-sm leading-6 text-slate-600">{notification.message}</p><time className="mt-1 block text-xs text-slate-500" dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div>{!notification.read && <button type="button" onClick={() => void markRead(notification.id)} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:self-center"><Check aria-hidden="true" className="size-4" /> Mark read</button>}</li>)}</ol>}
  </main>;
}

export default function NotificationsDashboard() {
  return <AuthGuard><NotificationsList /></AuthGuard>;
}
