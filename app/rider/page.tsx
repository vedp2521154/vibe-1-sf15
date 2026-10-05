"use client";

import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import type { ReactNode } from "react";
import { BusFront, Check, Clock3, RefreshCw, X } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { PassengerStatusBadge, RideStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dateFormat";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { userFacingMessage } from "@/lib/userFacingMessage";
import { isRider, type Ride } from "@/lib/types";
import { useVehicleName } from "@/lib/useVehicleSettings";
import { getRideDurationMinutes, getRideEstimatedEndAt } from "@/lib/scheduling";
import CancelRideControl from "@/components/CancelRideControl";

interface RideResponse {
  rides?: Ride[];
  ride?: Ride;
  error?: string;
  message?: string;
}

function RideSummary({ ride }: { ride: Ride }) {
  const scheduled = formatDateTime(ride.scheduledAt);
  const estimatedEnd = formatDateTime(getRideEstimatedEndAt(ride));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-bold tracking-tight text-slate-950">
          {ride.from} <span className="px-1 text-mobility-600">→</span> {ride.to}
        </h3>
        <RideStatusBadge status={ride.status} />
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
        <Clock3 aria-hidden="true" className="size-4 text-mobility-600" />
        <span>{scheduled.date}{scheduled.time ? ` · ${scheduled.time}` : ""} → {estimatedEnd.time || "End"} · {getRideDurationMinutes(ride)} min</span>
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Requested by <span className="font-semibold text-slate-900">{ride.requestedBy.name}</span>
        <span className="text-slate-400"> · </span>
        {ride.passengers.length} {ride.passengers.length === 1 ? "passenger" : "passengers"}
      </p>
    </>
  );
}

function AcceptedRideCard({ ride, busyAction, vehicleName, onAction, onCancelled }: {
  ride: Ride;
  busyAction: string;
  vehicleName: string;
  onAction: (key: string, url: string, method: "POST" | "PATCH", body?: object) => void;
  onCancelled: () => void;
}) {
  const canComplete = ride.passengers.length > 0 && ride.passengers.every((passenger) => passenger.pickupStatus === "boarded" || passenger.pickupStatus === "missed");
  return <article className="rounded-xl border border-mobility-300 bg-white p-5 shadow-sm sm:border-l-4 sm:p-6">
    <RideSummary ride={ride} />
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-bold text-slate-900">Passengers</h3>
      <ul className="mt-3 divide-y divide-slate-100">
        {ride.passengers.map((passenger, index) => <li key={`${index}-${passenger.name}`} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-mobility-50 text-sm font-bold text-mobility-800">{passenger.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 break-words font-semibold text-slate-900">{passenger.name}</span><span className="shrink-0"><PassengerStatusBadge status={passenger.pickupStatus} /></span></div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:shrink-0">
            <button type="button" disabled={Boolean(busyAction)} onClick={() => onAction(`${ride._id}-${index}`, `/api/rides/${ride._id}/passenger`, "PATCH", { passengerIndex: index, pickupStatus: "boarded" })} aria-pressed={passenger.pickupStatus === "boarded"} className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition disabled:opacity-60 sm:px-3 ${passenger.pickupStatus === "boarded" ? "border-mobility-300 bg-mobility-50 text-mobility-800" : "border-slate-200 text-slate-700 hover:bg-mobility-50 hover:text-mobility-800"}`}><Check aria-hidden="true" className="size-4" /> Boarded</button>
            <button type="button" disabled={Boolean(busyAction)} onClick={() => onAction(`${ride._id}-${index}`, `/api/rides/${ride._id}/passenger`, "PATCH", { passengerIndex: index, pickupStatus: "missed" })} aria-pressed={passenger.pickupStatus === "missed"} className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-semibold transition disabled:opacity-60 sm:px-3 ${passenger.pickupStatus === "missed" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-800"}`}><X aria-hidden="true" className="size-4" /> Missed</button>
          </div>
        </li>)}
      </ul>
    </div>
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      {!canComplete && <p className="text-sm text-slate-500">Mark every passenger as Boarded or Missed to finish the trip.</p>}
      <div className="flex flex-wrap justify-end gap-2 sm:ml-auto">
        <CancelRideControl ride={ride} onCancelled={onCancelled} />
        <button type="button" disabled={!canComplete || Boolean(busyAction)} onClick={() => onAction(ride._id ?? "complete", `/api/rides/${ride._id}/complete`, "POST")} className="h-12 rounded-xl bg-mobility-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-mobility-700 disabled:cursor-not-allowed disabled:opacity-50">{busyAction === `${ride._id ?? "complete"}` ? "Completing…" : `Complete ${vehicleName} Trip`}</button>
      </div>
    </div>
  </article>;
}

function EmptySection({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center text-sm text-slate-500">
      <BusFront aria-hidden="true" className="size-5 text-slate-400" />
      <p>{children}</p>
    </div>
  );
}

function RiderDashboard() {
  const vehicleName = useVehicleName();
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const user = parseSessionUser(session);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshRides = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch("/api/rides?view=rider", { cache: "no-store" });
      const result = (await response.json()) as RideResponse;
      if (!response.ok) throw new Error(result.error ?? "Could not load ride requests.");
      setRides(result.rides ?? []);
      setError("");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load ride requests.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isRider(user?.role, user?.category)) return;
    let active = true;
    fetch("/api/rides?view=rider", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as RideResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not load ride requests.");
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
          setError(fetchError instanceof Error ? fetchError.message : "Could not load ride requests.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.category, user?.role]);

  async function performAction(key: string, url: string, method: "POST" | "PATCH", body?: object) {
    setBusyAction(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json()) as RideResponse;
      if (!response.ok) throw new Error(result.error ?? "The ride could not be updated.");
      await refreshRides();
      setMessage(result.message ?? "Ride information saved.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The ride could not be updated.");
    } finally {
      setBusyAction("");
    }
  }

  const pendingRides = rides.filter((ride) => ride.status === "pending");
  const waitlistedRides = rides.filter((ride) => ride.status === "waitlisted");
  const clashRides = rides.filter((ride) => ride.status === "clash");
  const acceptedRides = rides.filter((ride) => ride.status === "accepted");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-mobility-800">Rider workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Rider Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Manage incoming {vehicleName} requests and the current trip.</p>
        </div>
        <div className={`self-start rounded-xl border px-4 py-3 sm:min-w-52 sm:self-auto ${acceptedRides.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-mobility-200 bg-mobility-50 text-mobility-800"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{vehicleName} Status</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${acceptedRides.length ? "bg-amber-500" : "bg-mobility-500"}`} />
            {isLoading ? "Checking…" : error && rides.length === 0 ? "Unavailable" : acceptedRides.length ? "Scheduled" : "Available"}
          </p>
          <p className="mt-1 text-xs opacity-80">{acceptedRides.length ? `${acceptedRides.length} ride(s) confirmed.` : "Ready for the next ride."}</p>
        </div>
      </div>

      {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{userFacingMessage(error, "Ride information is temporarily unavailable. Please try again shortly.")}</p>}
      {message && <p className="mb-5 rounded-xl border border-mobility-200 bg-mobility-50 px-4 py-3 text-sm font-medium text-mobility-800" role="status">{message}</p>}

      <section aria-labelledby="active-ride-heading" className="mb-9">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-mobility-800">On the road</p>
            <h2 id="active-ride-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Accepted Rides</h2>
          </div>
        <button type="button" onClick={() => void refreshRides(true)} disabled={isLoading || Boolean(busyAction)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 disabled:opacity-60">
            <RefreshCw aria-hidden="true" className="size-4" /> Refresh
          </button>
        </div>

        {isLoading ? <EmptySection>Loading accepted rides…</EmptySection> : acceptedRides.length ? (
          <div className="grid gap-4">{acceptedRides.map((ride) => <AcceptedRideCard key={ride._id ?? ride.createdAt} ride={ride} busyAction={busyAction} vehicleName={vehicleName} onAction={(key, url, method, body) => void performAction(key, url, method, body)} onCancelled={() => void refreshRides(true)} />)}</div>
        ) : error && rides.length === 0 ? (
          <EmptySection>Ride status is unavailable right now. Try refreshing.</EmptySection>
        ) : (
          <EmptySection>No accepted ride is scheduled. The {vehicleName} is available.</EmptySection>
        )}
      </section>

      <section aria-labelledby="pending-rides-heading" className="mb-9">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-mobility-800">Needs review</p>
            <h2 id="pending-rides-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Pending Requests</h2>
          </div>
          {!isLoading && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{pendingRides.length} {pendingRides.length === 1 ? "request" : "requests"}</span>}
        </div>
        {isLoading ? <EmptySection>Loading ride requests…</EmptySection> : error && rides.length === 0 ? <EmptySection>Ride requests are unavailable right now.</EmptySection> : pendingRides.length === 0 ? <EmptySection>No pending ride requests.</EmptySection> : (
          <div className="grid gap-4 xl:grid-cols-2">
            {pendingRides.map((ride) => (
              <article key={ride._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <RideSummary ride={ride} />
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-900">Passengers</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">{ride.passengers.map((passenger) => passenger.name).join(", ")}</p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void performAction(ride._id ?? "", `/api/rides/${ride._id}/accept`, "POST")}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-mobility-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-mobility-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mobility-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === ride._id ? "Accepting…" : "Accept Ride"}
                </button>
                <div className="mt-3 flex justify-end"><CancelRideControl ride={ride} onCancelled={() => void refreshRides(true)} /></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="waitlisted-rides-heading" className="mb-9">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-amber-700">Time conflict</p><h2 id="waitlisted-rides-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Waitlisted Requests</h2></div>{!isLoading && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{waitlistedRides.length}</span>}</div>
        {isLoading ? <EmptySection>Loading waitlisted requests…</EmptySection> : waitlistedRides.length === 0 ? <EmptySection>No waitlisted requests.</EmptySection> : <div className="grid gap-4 xl:grid-cols-2">{waitlistedRides.map((ride) => <article key={ride._id} className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6"><RideSummary ride={ride} /><p className="mt-3 text-sm text-amber-800">This time overlaps another confirmed ride. The request will return to Pending when availability opens.</p><p className="mt-3 text-sm text-slate-600">{ride.passengers.map((passenger) => passenger.name).join(", ")}</p><div className="mt-4 flex justify-end"><CancelRideControl ride={ride} onCancelled={() => void refreshRides(true)} /></div></article>)}</div>}
      </section>

      <section aria-labelledby="clash-rides-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-rose-700">Same-time requests</p>
            <h2 id="clash-rides-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Clash Requests</h2>
          </div>
          {!isLoading && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{clashRides.length}</span>}
        </div>
        {isLoading ? <EmptySection>Loading clash requests…</EmptySection> : error && rides.length === 0 ? <EmptySection>Ride requests are unavailable right now.</EmptySection> : clashRides.length === 0 ? <EmptySection>No clash requests.</EmptySection> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {clashRides.map((ride) => (
              <article key={ride._id} className="rounded-xl border border-rose-200 border-l-4 bg-white p-5 shadow-sm sm:p-6">
                <RideSummary ride={ride} />
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-900">Passengers</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{ride.passengers.map((passenger) => passenger.name).join(", ")}</p>
                  <p className="mt-3 text-xs leading-5 text-rose-700">Another request is already assigned for this time.</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {rides.some((ride) => ride.status === "cancelled") && <section aria-labelledby="cancelled-rides-heading" className="mt-9"><h2 id="cancelled-rides-heading" className="mb-4 text-xl font-semibold tracking-tight text-slate-950">Cancelled Rides</h2><div className="grid gap-4 lg:grid-cols-2">{rides.filter((ride) => ride.status === "cancelled").map((ride) => <article key={ride._id} className="rounded-xl border border-slate-200 bg-white p-5"><RideSummary ride={ride} /><p className="mt-3 text-sm text-slate-600">Cancellation reason: {ride.cancellationReason || "Not provided"}</p></article>)}</div></section>}
      <div className="sr-only" aria-live="polite">{user?.name ? `Signed in as ${user.name}` : ""}</div>
    </main>
  );
}

export default function RiderPage() {
  return (
    <AuthGuard allowedFor="rider">
      <RiderDashboard />
    </AuthGuard>
  );
}
