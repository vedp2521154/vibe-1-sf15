"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { CalendarDays, Clock3, MapPin, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { PassengerRideStatusBadge, RideStatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/dateFormat";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { userFacingMessage } from "@/lib/userFacingMessage";
import { isRequester, type LocationName, type Ride } from "@/lib/types";
import { DEFAULT_RIDE_DURATION_MINUTES, getRideDurationMinutes, getRideEstimatedEndAt } from "@/lib/scheduling";
import CancelRideControl from "@/components/CancelRideControl";

interface PassengerInput {
  id: number;
  name: string;
}

interface RideResponse {
  rides?: Ride[];
  error?: string;
}

interface RequestConfigResponse { locations?: Array<{ name: string }>; settings?: { vehicleName: string; passengerCapacity: number }; error?: string }

function requesterRole(role: string | undefined, category?: "requester" | "rider" | "admin"): string | null {
  return role && isRequester(role, category) ? role : null;
}

async function fetchRequesterRides(name: string, role: string): Promise<Ride[]> {
  const query = new URLSearchParams({ requestedBy: name, role });
  const response = await fetch(`/api/rides?${query.toString()}`);
  const result = (await response.json()) as RideResponse;

  if (!response.ok) {
    throw new Error(result.error ?? "Could not load your requests.");
  }

  return result.rides ?? [];
}

function RequestPageContent() {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    () => null,
  );
  const user = parseSessionUser(session);
  const name = user?.name;
  const role = requesterRole(user?.role, user?.category);

  const [from, setFrom] = useState<LocationName | "">("");
  const [to, setTo] = useState<LocationName | "">("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(DEFAULT_RIDE_DURATION_MINUTES);
  const [passengers, setPassengers] = useState<PassengerInput[]>([{ id: 0, name: "" }]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [isLoadingRides, setIsLoadingRides] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [vehicleName, setVehicleName] = useState("Toto");
  const [passengerCapacity, setPassengerCapacity] = useState(5);
  const [configLoaded, setConfigLoaded] = useState(false);
  const nextPassengerId = useRef(1);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/config/locations"), fetch("/api/config/settings")])
      .then(async ([locationsResponse, settingsResponse]) => {
        const [locationData, settingsData] = await Promise.all([locationsResponse.json(), settingsResponse.json()]) as [RequestConfigResponse, RequestConfigResponse];
        if (!locationsResponse.ok || !settingsResponse.ok) throw new Error(locationData.error ?? settingsData.error ?? "Ride settings are unavailable.");
        if (active) {
          setLocations((locationData.locations ?? []).map((location) => location.name));
          setVehicleName(settingsData.settings?.vehicleName ?? "Toto");
          setPassengerCapacity(settingsData.settings?.passengerCapacity ?? 5);
        }
      })
      .catch((error: unknown) => { if (active) setFormError(error instanceof Error ? error.message : "Ride settings are unavailable."); })
      .finally(() => { if (active) setConfigLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!name || !role) return;

    let active = true;
    const refresh = () => {
      fetchRequesterRides(name, role)
        .then((rides) => {
          if (active) {
            setMyRides(rides);
            setListError("");
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setListError(error instanceof Error ? error.message : "Could not load your requests.");
          }
        })
        .finally(() => {
          if (active) setIsLoadingRides(false);
        });
    };

    refresh();
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, [name, role]);

  function updatePassenger(id: number, value: string) {
    setPassengers((current) =>
      current.map((passenger) =>
        passenger.id === id ? { ...passenger, name: value } : passenger,
      ),
    );
  }

  function addPassenger() {
    setPassengers((current) => {
      if (current.length >= passengerCapacity) return current;

      return [...current, { id: nextPassengerId.current++, name: "" }];
    });
  }

  function removePassenger(id: number) {
    setPassengers((current) =>
      current.length > 1 ? current.filter((passenger) => passenger.id !== id) : current,
    );
  }

  async function refreshMyRequests() {
    if (!name || !role) return;
    setIsLoadingRides(true);
    setListError("");
    try {
      setMyRides(await fetchRequesterRides(name, role));
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not load your requests.");
    } finally {
      setIsLoadingRides(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!from || !to) {
      setFormError("Choose both a pickup location and a destination.");
      return;
    }

    if (from === to) {
      setFormError("Pickup and destination must be different.");
      return;
    }

    if (!date || !time) {
      setFormError("Choose a date and time for your ride.");
      return;
    }

    const scheduledAt = `${date}T${time}:00`;
    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      setFormError("Choose a valid date and time for your ride.");
      return;
    }

    if (scheduledDate.getTime() <= Date.now()) {
      setFormError("Choose a future date and time.");
      return;
    }

    const passengerNames = passengers.map((passenger) => passenger.name.trim());
    if (passengerNames.some((passengerName) => !passengerName)) {
      setFormError("Fill in each passenger name or remove that row.");
      return;
    }

    if (!name || !role) {
      setFormError("Your session has expired. Log in again to request a ride.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedBy: { name, role },
          from,
          to,
          scheduledAt,
          estimatedDurationMinutes,
          passengers: passengerNames.map((passengerName) => ({ name: passengerName })),
        }),
      });
      const result = (await response.json()) as { ride?: Ride; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Your request could not be submitted.");
      }

      setFrom("");
      setTo("");
      setDate("");
      setTime("");
      setEstimatedDurationMinutes(DEFAULT_RIDE_DURATION_MINUTES);
      setPassengers([{ id: nextPassengerId.current++, name: name }]);
      setSuccessMessage(result.ride?.status === "waitlisted"
        ? "Your request was added to the waitlist because its time overlaps a confirmed ride."
        : "Your ride request was submitted successfully.");
      setIsLoadingRides(true);
      try {
        setMyRides(await fetchRequesterRides(name, role));
        setListError("");
      } catch (error) {
        setListError(error instanceof Error ? error.message : "Your request was saved, but the list could not refresh.");
      } finally {
        setIsLoadingRides(false);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Your request could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-mobility-800">Your commute</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Request a Ride</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Plan your campus trip quickly.
          </p>
        </div>
        {name && (
          <p className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            Requesting as <span className="font-semibold text-slate-900">{name}</span>
          </p>
        )}
      </div>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-start lg:gap-8">
      <form onSubmit={handleSubmit} aria-labelledby="new-request-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="mb-5">
          <h2 id="new-request-heading" className="text-lg font-semibold text-slate-950">New Ride Request</h2>
          <p className="mt-1 text-sm text-slate-600">Choose your route and who is travelling.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">
            <span className="mb-2 flex items-center gap-2"><MapPin aria-hidden="true" className="size-4 text-mobility-600" />From</span>
            <select
              value={from}
              onChange={(event) => setFrom(event.target.value as LocationName | "")}
              required
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
            >
              <option value="" disabled>Select pickup location</option>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            <span className="mb-2 flex items-center gap-2"><Clock3 aria-hidden="true" className="size-4 text-mobility-600" />Estimated trip duration</span>
            <select value={estimatedDurationMinutes} onChange={(event) => setEstimatedDurationMinutes(Number(event.target.value))} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10">
              {[15, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            <span className="mb-2 flex items-center gap-2"><MapPin aria-hidden="true" className="size-4 text-mobility-600" />To</span>
            <select
              value={to}
              onChange={(event) => setTo(event.target.value as LocationName | "")}
              required
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
            >
              <option value="" disabled>Select destination</option>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            <span className="mb-2 flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 text-mobility-600" />Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            <span className="mb-2 flex items-center gap-2"><Clock3 aria-hidden="true" className="size-4 text-mobility-600" />Time</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
            />
          </label>
        </div>

        <section className="mt-7 border-t border-slate-100 pt-6" aria-labelledby="passengers-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="passengers-heading" className="text-base font-bold text-slate-900">Passengers</h2>
              <p className="mt-1 text-sm text-slate-500">Add everyone travelling in this request.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {passengers.length} {passengers.length === 1 ? "person" : "people"}
            </span>
          </div>

          <div className="space-y-3">
            {passengers.map((passenger, index) => (
              <div key={passenger.id} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`passenger-${passenger.id}`}>Passenger {index + 1} name</label>
                <input
                  id={`passenger-${passenger.id}`}
                  type="text"
                  autoComplete="off"
                  value={passenger.name}
                  onChange={(event) => updatePassenger(passenger.id, event.target.value)}
                  placeholder={index === 0 ? "Passenger name" : "Additional passenger name"}
                  required
                  className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
                />
                {passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePassenger(passenger.id)}
                    aria-label={`Remove passenger ${index + 1}`}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPassenger}
            disabled={!configLoaded || passengers.length >= passengerCapacity}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-mobility-200 px-3 text-sm font-semibold text-mobility-800 transition hover:bg-mobility-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Passenger
          </button>
          <p className="mt-2 text-xs text-slate-500">Maximum {passengerCapacity} passengers per ride.</p>
        </section>

        {formError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{userFacingMessage(formError, "Your request could not be completed. Please try again shortly.")}</p>}
        {successMessage && <p className="mt-4 rounded-xl border border-mobility-200 bg-mobility-50 px-4 py-3 text-sm font-medium text-mobility-800" role="status">{successMessage}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">Your request will be sent to the rider for review.</p>
          <button
            type="submit"
            disabled={isSubmitting || !configLoaded || locations.length < 2}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-mobility-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-mobility-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mobility-600/20 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Submitting…" : `Request ${vehicleName}`}
          </button>
        </div>
      </form>

      <section className="min-w-0" aria-labelledby="my-requests-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-mobility-800">Your rides</p>
            <h2 id="my-requests-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">My Requests</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isLoadingRides && <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{myRides.length} {myRides.length === 1 ? "request" : "requests"}</span>}
            <button type="button" onClick={() => void refreshMyRequests()} disabled={isLoadingRides || isSubmitting} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobility-600 disabled:opacity-60">
              <RefreshCw aria-hidden="true" className="size-4" /> Refresh
            </button>
          </div>
        </div>

        {listError && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">{userFacingMessage(listError, "Ride requests are temporarily unavailable. Please try again shortly.")}</p>}

        {isLoadingRides ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500" role="status">Loading your requests…</div>
        ) : listError && myRides.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">Your requests are unavailable right now. Try refreshing.</div>
        ) : myRides.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-9 text-center">
            <p className="text-sm font-semibold text-slate-800">No ride requests yet</p>
            <p className="mt-1 text-sm text-slate-500">Your submitted requests will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myRides.map((ride) => {
              const scheduled = formatDateTime(ride.scheduledAt);
              return (
                <article key={ride._id ?? `${ride.createdAt}-${ride.scheduledAt}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-bold tracking-tight text-slate-950">
                      {ride.from} <span className="px-1 text-mobility-600">→</span> {ride.to}
                    </h3>
                    <RideStatusBadge status={ride.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4 shrink-0 text-mobility-600" />{scheduled.date}{scheduled.time ? ` · ${scheduled.time}` : ""}</p>
                    <p className="flex items-center gap-2"><Users aria-hidden="true" className="size-4 shrink-0 text-mobility-600" />{ride.passengers.length} {ride.passengers.length === 1 ? "passenger" : "passengers"}</p>
                    <p>{scheduled.time || "Start"} → {formatDateTime(getRideEstimatedEndAt(ride)).time || "End"} · {getRideDurationMinutes(ride)} min</p>
                  </div>
                  {ride.status === "waitlisted" && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">This time overlaps another confirmed ride. Your request is waiting for availability.</p>}
                  {ride.status === "cancelled" && ride.cancellationReason && <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">Cancellation reason: {ride.cancellationReason}</p>}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-sm font-semibold text-slate-800">Passengers</p>
                    <ul className="mt-2 space-y-2">
                      {ride.passengers.map((passenger, index) => (
                        <li key={`${ride._id ?? ride.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 break-words text-slate-600">{passenger.name}</span>
                          <PassengerRideStatusBadge rideStatus={ride.status} pickupStatus={passenger.pickupStatus} />
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(ride.status === "pending" || ride.status === "waitlisted") && <div className="mt-4 flex justify-end border-t border-slate-100 pt-4"><CancelRideControl ride={ride} onCancelled={() => { setSuccessMessage("Your ride request was cancelled."); void refreshMyRequests(); }} /></div>}
                </article>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </main>
  );
}

export default function RequestPage() {
  return (
    <AuthGuard allowedFor="requester">
      <RequestPageContent />
    </AuthGuard>
  );
}
