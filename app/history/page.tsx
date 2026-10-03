"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CalendarDays, History, RefreshCw } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { PassengerStatusBadge, RideStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dateFormat";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { userFacingMessage } from "@/lib/userFacingMessage";
import type { Ride, UserRole } from "@/lib/types";

interface RideResponse {
  rides?: Ride[];
  error?: string;
}

function RideHistoryCard({ ride, role, name }: { ride: Ride; role: UserRole; name: string }) {
  const scheduled = formatDateTime(ride.scheduledAt);
  const completed = ride.completedAt ? formatDateTime(ride.completedAt) : null;
  const passenger = role === "rider"
    ? undefined
    : ride.passengers.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">
          {ride.from} <span className="px-1 text-mobility-600">→</span> {ride.to}
        </h2>
        <RideStatusBadge status={ride.status} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-mobility-600" />
        <span>{scheduled.date}{scheduled.time ? ` · ${scheduled.time}` : ""}</span>
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Requested by <span className="font-semibold text-slate-900">{ride.requestedBy.name}</span>
      </p>

      {role === "rider" ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-bold text-slate-900">Passengers</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {ride.passengers.map((entry, index) => (
              <li key={`${ride._id ?? ride.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-2">
                <span className="min-w-0 break-words font-medium text-slate-800">{entry.name}</span>
                <PassengerStatusBadge status={entry.pickupStatus} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-700">
          Your status: {passenger ? <PassengerStatusBadge status={passenger.pickupStatus} /> : <span className="font-semibold">Not listed</span>}
        </p>
      )}

      {role === "rider" && completed?.date && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Completed {completed.date}{completed.time ? ` · ${completed.time}` : ""}
        </p>
      )}
    </article>
  );
}

function HistoryContent() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const user = parseSessionUser(session);
  const role = user?.role;
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.name || !role) return;
    let active = true;
    const query = new URLSearchParams({ view: "history", role });
    if (role !== "rider") query.set("name", user.name);

    fetch(`/api/rides?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as RideResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not load ride history.");
        return result.rides ?? [];
      })
      .then((loadedRides) => {
        if (active) {
          setRides(loadedRides);
          setError("");
        }
      })
      .catch((fetchError: unknown) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Could not load ride history.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role, refreshKey, user?.name]);

  const isRider = role === "rider";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-mobility-700">Your journeys</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Trip History</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isRider ? "Review every completed trip." : "Your campus ride history."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setIsLoading(true); setRefreshKey((current) => current + 1); }}
          disabled={isLoading}
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> Refresh
        </button>
      </div>

      {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{userFacingMessage(error, "Trip history is temporarily unavailable. Please try again shortly.")}</p>}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500" role="status">Loading ride history…</div>
      ) : error && rides.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">History is unavailable right now. Try refreshing.</div>
      ) : rides.length === 0 ? (
        <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-mobility-50 text-mobility-700">
            <History aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-slate-900">{isRider ? "No completed trips yet." : "No trips in your history yet."}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Completed rides will appear here when available.
          </p>
        </section>
      ) : (
        <section aria-label="Completed rides" className="grid gap-4 md:grid-cols-2">
          {rides.map((ride) => <RideHistoryCard key={ride._id ?? ride.createdAt} ride={ride} role={role ?? "student"} name={user?.name ?? ""} />)}
        </section>
      )}
    </main>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
