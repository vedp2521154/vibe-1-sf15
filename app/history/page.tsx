"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CalendarDays, History, RefreshCw, Search } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { PassengerRideStatusBadge, RideStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dateFormat";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { isAdmin, isOperationalRole, isRequester, type Ride, type UserRole } from "@/lib/types";
import { userFacingMessage } from "@/lib/userFacingMessage";
import { getRideDurationMinutes, getRideEstimatedEndAt } from "@/lib/scheduling";

interface RideResponse { rides?: Ride[]; total?: number; page?: number; pageSize?: number; error?: string }
type AdminAction = { kind: "archive" | "delete"; ride: Ride } | null;

function RideHistoryCard({
  ride, role, category, name, onArchive, onRestore, onDelete,
}: {
  ride: Ride;
  role: UserRole;
  category?: "requester" | "rider" | "admin";
  name: string;
  onArchive: (ride: Ride) => void;
  onRestore: (ride: Ride) => void;
  onDelete: (ride: Ride) => void;
}) {
  const scheduled = formatDateTime(ride.scheduledAt);
  const completed = ride.completedAt ? formatDateTime(ride.completedAt) : null;
  const estimatedEnd = formatDateTime(getRideEstimatedEndAt(ride));
  const canSeeAllRides = isOperationalRole(role, category);
  const canManageArchive = isAdmin(role, category);
  const archived = ride.archived === true;
  const passenger = canSeeAllRides
    ? undefined
    : ride.passengers.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">{ride.from} <span className="px-1 text-mobility-600">→</span> {ride.to}</h2>
          {archived && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Archived</span>}
        </div>
        <RideStatusBadge status={ride.status} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-mobility-600" />
        <span>{scheduled.date}{scheduled.time ? ` · ${scheduled.time}` : ""} → {estimatedEnd.time || "End"} · {getRideDurationMinutes(ride)} min</span>
      </p>
      <p className="mt-3 text-sm text-slate-600">Requested by <span className="font-semibold text-slate-900">{ride.requestedBy.name}</span></p>

      {canSeeAllRides ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-bold text-slate-900">Passengers</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {ride.passengers.map((entry, index) => (
              <li key={`${ride._id ?? ride.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-2">
                <span className="min-w-0 break-words font-medium text-slate-800">{entry.name}</span>
                <PassengerRideStatusBadge rideStatus={ride.status} pickupStatus={entry.pickupStatus} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-700">Your status: {passenger ? <PassengerRideStatusBadge rideStatus={ride.status} pickupStatus={passenger.pickupStatus} /> : <span className="font-semibold">Not listed</span>}</p>
      )}

      {ride.status === "cancelled" && <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Cancellation reason: {ride.cancellationReason || "Not provided"}</p>}

      {canSeeAllRides && completed?.date && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Completed {completed.date}{completed.time ? ` · ${completed.time}` : ""}</p>}
      {canManageArchive && ride.status === "completed" && <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {archived ? <>
          <button type="button" onClick={() => onRestore(ride)} className="h-9 rounded-lg border border-mobility-200 px-3 text-sm font-semibold text-mobility-800 hover:bg-mobility-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600">Restore</button>
          <button type="button" onClick={() => onDelete(ride)} className="h-9 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Delete Permanently</button>
        </> : <button type="button" onClick={() => onArchive(ride)} className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600">Archive</button>}
      </div>}
    </article>
  );
}

function HistoryContent() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const user = parseSessionUser(session);
  const role = user?.role;
  const category = user?.category;
  const canManage = role ? isAdmin(role, category) : false;
  const [rides, setRides] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [pickupStatus, setPickupStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [archivedView, setArchivedView] = useState(false);
  const [confirmation, setConfirmation] = useState<AdminAction>(null);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!user?.name || !role) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      const query = new URLSearchParams({ view: "history", role, page: String(page), pageSize: String(pageSize), sort });
      if (isRequester(role, category)) query.set("name", user.name);
      if (search.trim()) query.set("search", search.trim());
      if (range !== "all") query.set("range", range);
      if (pickupStatus !== "all") query.set("pickupStatus", pickupStatus);
      if (canManage && archivedView) query.set("archived", "true");
      fetch(`/api/rides?${query.toString()}`, {
        cache: "no-store",
        headers: { "x-mobility-role": role },
      })
        .then(async (response) => {
          const result = await response.json() as RideResponse;
          if (!response.ok) throw new Error(result.error ?? "Could not load ride history.");
          return result;
        })
        .then((result) => {
          if (!active) return;
          setRides(result.rides ?? []);
          setTotal(result.total ?? 0);
          setError("");
          const pages = Math.max(1, Math.ceil((result.total ?? 0) / pageSize));
          if (page > pages) setPage(pages);
        })
        .catch((fetchError: unknown) => {
          if (active) setError(fetchError instanceof Error ? fetchError.message : "Could not load ride history.");
        })
        .finally(() => { if (active) setIsLoading(false); });
    }, 180);

    return () => { active = false; window.clearTimeout(timer); };
  }, [archivedView, canManage, category, page, pageSize, pickupStatus, range, refreshKey, role, search, sort, user?.name]);

  function resetPage(action: () => void) { action(); setPage(1); }

  async function refreshAfterAction(url: string, method: "PATCH" | "DELETE", body?: object) {
    if (!role) return;
    setIsActing(true); setError(""); setNotice("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-mobility-role": role },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json() as RideResponse;
      if (!response.ok) throw new Error(result.error ?? "Could not update the trip.");
      setConfirmation(null);
      setNotice(method === "DELETE" ? "Archived trip permanently deleted." : body && "archived" in body && body.archived ? "Trip archived." : "Trip restored.");
      setRefreshKey((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update the trip.");
    } finally { setIsActing(false); }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(search.trim()) || range !== "all" || pickupStatus !== "all";
  const isRequesterHistory = role ? isRequester(role, category) : false;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-mobility-700">Your journeys</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Trip History</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{canManage ? "Search, filter, and manage trip history." : isRequesterHistory ? "Your trip history." : "Campus trip history."}</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={isLoading} className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 disabled:opacity-60 sm:self-auto"><RefreshCw aria-hidden="true" className="size-4" /> Refresh</button>
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{userFacingMessage(error, "Trip history is temporarily unavailable. Please try again shortly.")}</p>}
      {notice && <p className="mb-4 rounded-xl border border-mobility-200 bg-mobility-50 px-4 py-3 text-sm font-medium text-mobility-800" role="status">{notice}</p>}

      {canManage && <div className="mb-4 inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="History view">
        <button type="button" role="tab" aria-selected={!archivedView} onClick={() => resetPage(() => setArchivedView(false))} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!archivedView ? "bg-mobility-50 text-mobility-800" : "text-slate-600 hover:bg-slate-50"}`}>Active History</button>
        <button type="button" role="tab" aria-selected={archivedView} onClick={() => resetPage(() => setArchivedView(true))} className={`rounded-lg px-4 py-2 text-sm font-semibold ${archivedView ? "bg-mobility-50 text-mobility-800" : "text-slate-600 hover:bg-slate-50"}`}>Archived</button>
      </div>}

      <section aria-label="History search and filters" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.8fr)_repeat(3,minmax(130px,1fr))_auto]">
          <label className="relative block sm:col-span-2 lg:col-span-1"><span className="sr-only">Search trips</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search by passenger, requester or route..." className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-mobility-600 focus:outline-none focus:ring-2 focus:ring-mobility-600/20" /></label>
          <label className="text-xs font-semibold text-slate-600">Date<select value={range} onChange={(event) => resetPage(() => setRange(event.target.value))} className="mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="all">All dates</option><option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Passenger status<select value={pickupStatus} onChange={(event) => resetPage(() => setPickupStatus(event.target.value))} className="mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="all">All statuses</option><option value="boarded">Boarded</option><option value="missed">Missed</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Sort<select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value))} className="mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Per page<select value={pageSize} onChange={(event) => resetPage(() => setPageSize(Number(event.target.value)))} className="mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
        </div>
      </section>

      {isLoading ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500" role="status">Loading ride history…</div> : rides.length === 0 ? (
        <section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-mobility-50 text-mobility-700"><History aria-hidden="true" className="size-6" /></span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{archivedView ? "No archived trips." : hasFilters ? "No trips match your search." : "No trip history found."}</h2>
          <p className="mt-2 text-sm text-slate-500">{archivedView ? "Archived trips will appear here." : "Completed or cancelled rides will appear here when available."}</p>
        </section>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500"><span>{total} {total === 1 ? "trip" : "trips"}</span><span>Page {page} of {pages}</span></div>
          <section aria-label={archivedView ? "Archived trips" : "Completed rides"} className="grid gap-4 md:grid-cols-2">
            {rides.map((ride) => <RideHistoryCard key={ride._id ?? ride.createdAt} ride={ride} role={role ?? "student"} category={category} name={user?.name ?? ""} onArchive={(selected) => setConfirmation({ kind: "archive", ride: selected })} onRestore={(selected) => { if (selected._id) void refreshAfterAction(`/api/rides/${selected._id}/archive`, "PATCH", { archived: false }); }} onDelete={(selected) => setConfirmation({ kind: "delete", ride: selected })} />)}
          </section>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={isLoading || page <= 1} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
        <span className="text-sm font-medium text-slate-600">Page {page} of {pages}</span>
        <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={isLoading || page >= pages} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
      </div>

      {confirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isActing) setConfirmation(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="history-confirm-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <h2 id="history-confirm-title" className="text-lg font-bold text-slate-950">{confirmation.kind === "archive" ? "Archive this trip?" : "Delete this archived trip permanently?"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{confirmation.kind === "archive" ? "It will be hidden from normal history but kept in the database." : "This action cannot be undone and the trip will be removed from MongoDB."}</p>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{confirmation.ride.from} → {confirmation.ride.to}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setConfirmation(null)} disabled={isActing} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => { const action = confirmation; if (!action.ride._id) return; void refreshAfterAction(action.kind === "archive" ? `/api/rides/${action.ride._id}/archive` : `/api/rides/${action.ride._id}`, action.kind === "archive" ? "PATCH" : "DELETE", action.kind === "archive" ? { archived: true } : undefined); }} disabled={isActing} className={`h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${confirmation.kind === "archive" ? "bg-slate-700 hover:bg-slate-800" : "bg-rose-600 hover:bg-rose-700"}`}>{isActing ? "Working…" : confirmation.kind === "archive" ? "Archive" : "Delete Permanently"}</button>
          </div>
        </section>
      </div>}
    </main>
  );
}

export default function HistoryPage() { return <AuthGuard><HistoryContent /></AuthGuard>; }
