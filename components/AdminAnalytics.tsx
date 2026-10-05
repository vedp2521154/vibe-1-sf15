"use client";

import { useEffect, useState } from "react";

type Range = "today" | "7" | "30" | "all";
interface Analytics {
  totalRides: number; completedRides: number; pendingRides: number; waitlistedRides: number;
  cancelledRides: number; acceptedRides: number; clashRides: number;
  boardedPassengers: number; missedPassengers: number; boardingRate: number | null;
  completionRate: number | null; eligibleRides: number; cancellationCount: number;
  mostUsedRoute: { from: string; to: string; count: number } | null;
  peakRequestTime: { from: string; to: string; count: number } | null;
  tripsByDay: Array<{ date: string; count: number }>;
}

const rangeOptions: Array<{ value: Range; label: string }> = [
  { value: "today", label: "Today" }, { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" }, { value: "all", label: "All time" },
];

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
    {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
  </article>;
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<Range>("7");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { analytics?: Analytics; error?: string };
        if (!response.ok || !result.analytics) throw new Error(result.error ?? "Analytics are unavailable.");
        return result.analytics;
      })
      .then((result) => { if (active) { setAnalytics(result); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Analytics are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range]);

  const maxTrips = Math.max(1, ...(analytics?.tripsByDay.map((day) => day.count) ?? []));
  const cards = analytics ? [
    ["Total rides", analytics.totalRides, "All requests in this range"],
    ["Completed", analytics.completedRides, "Trips completed"],
    ["Pending", analytics.pendingRides, "Awaiting rider review"],
    ["Waitlisted", analytics.waitlistedRides, "Waiting for a free slot"],
    ["Cancelled", analytics.cancelledRides, "Requests cancelled"],
    ["Missed passengers", analytics.missedPassengers, "Marked missed by the rider"],
    ["Boarded passengers", analytics.boardedPassengers, "Marked boarded by the rider"],
  ] as const : [];

  return <section aria-labelledby="analytics-heading" className="mb-9">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm font-semibold text-mobility-800">Operational overview</p><h2 id="analytics-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Ride analytics</h2></div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600">Date range
        <select value={range} onChange={(event) => setRange(event.target.value as Range)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
          {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
    {error && <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
    {loading && !analytics ? <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500" role="status">Loading analytics…</div> : analytics ? <>
      <div aria-busy={loading} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map(([label, value, hint]) => <MetricCard key={label} label={label} value={loading ? "…" : value} hint={hint} />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-semibold text-slate-900">Most used route</h3>
          {analytics.mostUsedRoute ? <><p className="mt-3 break-words text-lg font-bold text-slate-900">{analytics.mostUsedRoute.from} <span className="text-mobility-600">→</span> {analytics.mostUsedRoute.to}</p><p className="mt-1 text-sm text-slate-500">{analytics.mostUsedRoute.count} {analytics.mostUsedRoute.count === 1 ? "request" : "requests"}</p></> : <p className="mt-3 text-sm text-slate-500">No route data for this period.</p>}
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-semibold text-slate-900">Peak request time</h3>
          {analytics.peakRequestTime ? <><p className="mt-3 text-lg font-bold text-slate-900">{analytics.peakRequestTime.from} – {analytics.peakRequestTime.to}</p><p className="mt-1 text-sm text-slate-500">{analytics.peakRequestTime.count} {analytics.peakRequestTime.count === 1 ? "request" : "requests"}</p></> : <p className="mt-3 text-sm text-slate-500">No scheduled requests in this period.</p>}
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-semibold text-slate-900">Boarding rate</h3>
          {analytics.boardingRate === null ? <p className="mt-3 text-sm text-slate-500">No passengers marked yet.</p> : <><p className="mt-3 text-lg font-bold text-slate-900">{analytics.boardingRate}% boarded</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-mobility-600" style={{ width: `${analytics.boardingRate}%` }} /></div><p className="mt-2 text-xs text-slate-500">{analytics.boardedPassengers} boarded · {analytics.missedPassengers} missed</p></>}
        </article>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold text-slate-900">Trips by day</h3><span className="text-xs text-slate-500">Showing up to 14 recent active dates</span></div>
          {analytics.tripsByDay.length ? <ul className="mt-4 space-y-3">{analytics.tripsByDay.map((day) => <li key={day.date} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm"><span className="text-slate-600">{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-mobility-600" style={{ width: `${Math.max(3, day.count / maxTrips * 100)}%` }} /></span><span className="text-right font-semibold text-slate-800">{day.count}</span></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No rides in this period.</p>}
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="font-semibold text-slate-900">Ride completion</h3>
          <p className="mt-3 text-lg font-bold text-slate-900">{analytics.completionRate === null ? "—" : `${analytics.completionRate}%`}</p>
          <p className="mt-1 text-sm text-slate-500">{analytics.completedRides} completed of {analytics.eligibleRides} eligible rides (completed, accepted, or cancelled).</p>
          <p className="mt-3 text-sm text-slate-600">Cancellations: <span className="font-semibold text-slate-900">{analytics.cancellationCount}</span></p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-mobility-50 px-3 py-1">{analytics.acceptedRides} accepted</span><span className="rounded-full bg-amber-50 px-3 py-1">{analytics.waitlistedRides} waitlisted</span><span className="rounded-full bg-rose-50 px-3 py-1">{analytics.clashRides} clashes</span></div>
        </article>
      </div>
    </> : !error ? <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">No analytics available.</p> : null}
  </section>;
}
