"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, BusFront, CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { PassengerStatusBadge, RideStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dateFormat";
import { userFacingMessage } from "@/lib/userFacingMessage";
import type { Ride } from "@/lib/types";
import { useVehicleName } from "@/lib/useVehicleSettings";
import CancelRideControl from "@/components/CancelRideControl";
import { getRideDurationMinutes, getRideEstimatedEndAt } from "@/lib/scheduling";

interface RideResponse {
  rides?: Ride[];
  error?: string;
}

function RideDetails({ ride }: { ride: Ride }) {
  const scheduled = formatDateTime(ride.scheduledAt);
  const end = formatDateTime(getRideEstimatedEndAt(ride));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-lg font-bold tracking-tight text-slate-950">
          {ride.from} <span className="px-1 text-mobility-600">→</span> {ride.to}
        </h3>
        <RideStatusBadge status={ride.status} />
      </div>
      <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
        <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mobility-600" />
        <span>{scheduled.date}{scheduled.time ? ` · ${scheduled.time}` : ""} → {end.time || "End"} · {getRideDurationMinutes(ride)} min</span>
      </p>
      <p className="mt-3 break-words text-sm text-slate-600">
        Requested by <span className="font-semibold text-slate-900">{ride.requestedBy.name}</span>
        <span className="text-slate-400"> · </span>
        {ride.passengers.length} {ride.passengers.length === 1 ? "passenger" : "passengers"}
      </p>
    </>
  );
}

function PassengerList({ ride }: { ride: Ride }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-bold text-slate-900">Passengers</h4>
      <ul className="mt-2 divide-y divide-slate-100">
        {ride.passengers.map((passenger, index) => (
          <li key={`${ride._id ?? ride.createdAt}-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span className="min-w-0 break-words font-medium text-slate-800">{passenger.name}</span>
            <PassengerStatusBadge status={passenger.pickupStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptySection({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center text-sm text-slate-500">
      <BusFront aria-hidden="true" className="size-5 text-slate-400" />
      <p className="mt-2">{children}</p>
    </div>
  );
}

function SummaryCard({ label, value, detail, icon: Icon, tone = "green" }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BusFront;
  tone?: "green" | "amber" | "rose" | "slate";
}) {
  const tones = {
    green: "border-mobility-200 bg-mobility-50 text-mobility-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    slate: "border-slate-200 bg-white text-slate-800",
  };

  return (
    <article className={`min-w-0 rounded-xl border p-4 sm:p-5 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide opacity-80 sm:text-sm">{label}</p>
        <Icon aria-hidden="true" className="size-5 shrink-0 opacity-75" />
      </div>
      <p className="mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs opacity-80 sm:text-sm">{detail}</p>
    </article>
  );
}

function AdminDashboard() {
  const vehicleName = useVehicleName();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/rides?view=rider", { cache: "no-store" }),
      fetch("/api/rides?view=history&role=admin", { cache: "no-store" }),
    ])
      .then(async ([operationsResponse, historyResponse]) => {
        const [operationsResult, historyResult] = await Promise.all([
          operationsResponse.json() as Promise<RideResponse>,
          historyResponse.json() as Promise<RideResponse>,
        ]);
        if (!operationsResponse.ok) throw new Error(operationsResult.error ?? "Could not load current ride operations.");
        if (!historyResponse.ok) throw new Error(historyResult.error ?? "Could not load completed trips.");
        return [...(operationsResult.rides ?? []), ...(historyResult.rides ?? [])];
      })
      .then((loadedRides) => {
        if (active) {
          setRides(loadedRides);
          setError("");
        }
      })
      .catch((fetchError: unknown) => {
        if (active) setError(fetchError instanceof Error ? fetchError.message : "Could not load ride operations.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [refreshKey]);

  const acceptedRides = rides.filter((ride) => ride.status === "accepted");
  const pendingRides = rides.filter((ride) => ride.status === "pending");
  const waitlistedRides = rides.filter((ride) => ride.status === "waitlisted");
  const clashRides = rides.filter((ride) => ride.status === "clash");
  const cancelledRides = rides.filter((ride) => ride.status === "cancelled");
  const completedRides = rides.filter((ride) => ride.status === "completed");
  const count = (value: number) => isLoading ? "—" : String(value);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-mobility-800">
            <ShieldCheck aria-hidden="true" className="size-4" /> Mobility operations
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Admin / Mobility Desk</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Monitor campus {vehicleName} operations.</p>
        </div>
        <button
          type="button"
          onClick={() => { setIsLoading(true); setRefreshKey((current) => current + 1); }}
          disabled={isLoading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> Refresh
        </button>
      </div>

      {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{userFacingMessage(error, "Ride information is temporarily unavailable. Please try again shortly.")}</p>}

      <section aria-label={`${vehicleName} operations summary`} className="mb-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
        <SummaryCard
          label={`${vehicleName} Status`}
          value={isLoading ? "Checking…" : error && rides.length === 0 ? "Unavailable" : acceptedRides.length ? "Scheduled" : "Available"}
          detail={acceptedRides.length ? `${acceptedRides.length} confirmed time slot(s)` : "Ready for a ride"}
          icon={Activity}
          tone={acceptedRides.length ? "amber" : "green"}
        />
        <SummaryCard label="Pending Requests" value={count(pendingRides.length)} detail="Waiting for rider review" icon={Clock3} tone="slate" />
        <SummaryCard label="Waitlisted" value={count(waitlistedRides.length)} detail="Waiting for a free time slot" icon={Clock3} tone="amber" />
        <SummaryCard label="Cancelled" value={count(cancelledRides.length)} detail="Cancelled rides" icon={XCircle} tone="rose" />
        <SummaryCard label="Clash Requests" value={count(clashRides.length)} detail="Same-time conflicts" icon={AlertTriangle} tone="rose" />
        <SummaryCard label="Completed Trips" value={count(completedRides.length)} detail="Trips in ride history" icon={CheckCircle2} tone="green" />
      </section>

      <section aria-labelledby="admin-active-heading" className="mb-9">
        <div className="mb-4">
          <p className="text-sm font-semibold text-mobility-800">{vehicleName} status</p>
          <h2 id="admin-active-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Accepted Rides</h2>
        </div>
        {isLoading ? <EmptySection>Loading accepted rides…</EmptySection> : acceptedRides.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{acceptedRides.map((ride) => <article key={ride._id ?? ride.createdAt} className="rounded-xl border border-mobility-300 bg-white p-5 shadow-sm sm:border-l-4 sm:p-6"><RideDetails ride={ride} /><PassengerList ride={ride} /><div className="mt-4 flex justify-end border-t border-slate-100 pt-4"><CancelRideControl ride={ride} onCancelled={() => setRefreshKey((current) => current + 1)} /></div></article>)}</div>
        ) : error && rides.length === 0 ? <EmptySection>Ride status is unavailable right now. Try refreshing.</EmptySection> : (
          <EmptySection>No accepted ride is currently in progress. The {vehicleName} is available.</EmptySection>
        )}
      </section>

      <section aria-labelledby="admin-pending-heading" className="mb-9">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-mobility-800">Needs rider review</p>
            <h2 id="admin-pending-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Pending Requests</h2>
          </div>
          {!isLoading && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{pendingRides.length} {pendingRides.length === 1 ? "request" : "requests"}</span>}
        </div>
        {isLoading ? <EmptySection>Loading pending requests…</EmptySection> : pendingRides.length === 0 ? (
          <EmptySection>No pending requests.</EmptySection>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingRides.map((ride) => (
              <article key={ride._id ?? ride.createdAt} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <RideDetails ride={ride} />
                <PassengerList ride={ride} />
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-4"><CancelRideControl ride={ride} onCancelled={() => setRefreshKey((current) => current + 1)} /></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="admin-waitlisted-heading" className="mb-9">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-amber-700">Time conflicts</p><h2 id="admin-waitlisted-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Waitlisted Requests</h2></div>{!isLoading && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{waitlistedRides.length}</span>}</div>
        {isLoading ? <EmptySection>Loading waitlisted requests…</EmptySection> : waitlistedRides.length === 0 ? <EmptySection>No waitlisted requests.</EmptySection> : <div className="grid gap-4 lg:grid-cols-2">{waitlistedRides.map((ride) => <article key={ride._id ?? ride.createdAt} className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6"><RideDetails ride={ride} /><PassengerList ride={ride} /><p className="mt-3 text-sm text-amber-800">Waiting for a non-overlapping schedule window.</p><div className="mt-4 flex justify-end border-t border-slate-100 pt-4"><CancelRideControl ride={ride} onCancelled={() => setRefreshKey((current) => current + 1)} /></div></article>)}</div>}
      </section>

      <section aria-labelledby="admin-clash-heading" className="mb-9">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-rose-700">Same-time requests</p>
            <h2 id="admin-clash-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Clash Requests</h2>
          </div>
          {!isLoading && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{clashRides.length}</span>}
        </div>
        {isLoading ? <EmptySection>Loading clash requests…</EmptySection> : clashRides.length === 0 ? (
          <EmptySection>No clash requests.</EmptySection>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {clashRides.map((ride) => (
              <article key={ride._id ?? ride.createdAt} className="min-w-0 rounded-xl border border-rose-200 border-l-4 bg-white p-5 shadow-sm sm:p-6">
                <RideDetails ride={ride} />
                <PassengerList ride={ride} />
              </article>
            ))}
          </div>
        )}
      </section>

      {cancelledRides.length > 0 && <section aria-labelledby="admin-cancelled-heading" className="mb-9"><div className="mb-4"><p className="text-sm font-semibold text-slate-600">Audit trail</p><h2 id="admin-cancelled-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Cancelled Rides</h2></div><div className="grid gap-4 lg:grid-cols-2">{cancelledRides.map((ride) => <article key={ride._id ?? ride.createdAt} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><RideDetails ride={ride} /><p className="mt-3 text-sm text-slate-700">Reason: {ride.cancellationReason || "Not provided"}</p>{ride.cancelledBy && <p className="mt-1 text-xs text-slate-500">Cancelled by {ride.cancelledBy.name} · {ride.cancelledAt ? formatDateTime(ride.cancelledAt).date : ""}</p>}</article>)}</div></section>}

      <section aria-labelledby="admin-completed-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-mobility-800">Ride history</p>
            <h2 id="admin-completed-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Completed Trips</h2>
          </div>
          {!isLoading && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{completedRides.length} {completedRides.length === 1 ? "trip" : "trips"}</span>}
        </div>
        {isLoading ? <EmptySection>Loading completed trips…</EmptySection> : completedRides.length === 0 ? (
          <EmptySection>No completed trips yet.</EmptySection>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {completedRides.map((ride) => (
              <article key={ride._id ?? ride.createdAt} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <RideDetails ride={ride} />
                <PassengerList ride={ride} />
                {ride.completedAt && <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">Completed {formatDateTime(ride.completedAt).date}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard allowedFor="admin">
      <AdminDashboard />
    </AuthGuard>
  );
}
