"use client";

import { useState, useSyncExternalStore } from "react";
import { getSessionSnapshot, parseSessionUser, subscribeToSession } from "@/lib/session";
import { isRequester } from "@/lib/types";
import type { Ride } from "@/lib/types";

const cancellationReasons = ["User requested cancellation", "Vehicle unavailable", "Schedule changed", "Duplicate request", "Other"];

export default function CancelRideControl({ ride, onCancelled }: { ride: Ride; onCancelled: () => void }) {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const user = parseSessionUser(session);
  const requester = user ? isRequester(user.role, user.category) : false;
  const allowedStatus = ride.status === "pending" || ride.status === "waitlisted" || (!requester && ride.status === "accepted");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user || !allowedStatus || !ride._id) return null;
  async function submitCancellation() {
    const cancellationReason = requester
      ? "User requested cancellation"
      : reason === "Other" ? otherReason.trim() : reason;
    if (!cancellationReason) { setError("Choose or enter a cancellation reason."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rides/${ride._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancellationReason }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "This ride could not be cancelled.");
      setOpen(false); setReason(""); setOtherReason(""); onCancelled();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This ride could not be cancelled.");
    } finally { setSaving(false); }
  }

  return <>
    <button type="button" onClick={() => { setError(""); setOpen(true); }} className="h-10 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">{requester ? "Cancel Request" : "Cancel Ride"}</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby={`cancel-title-${ride._id}`} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <h2 id={`cancel-title-${ride._id}`} className="text-lg font-bold text-slate-950">{requester ? "Cancel this ride request?" : "Cancel this ride?"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">The ride will remain in history with a cancelled status.</p>
        {!requester && <label className="mt-4 block text-sm font-semibold text-slate-700">Cancellation reason
          <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900">
            <option value="">Choose a reason</option>{cancellationReasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {reason === "Other" && <textarea value={otherReason} onChange={(event) => setOtherReason(event.target.value)} maxLength={500} rows={3} placeholder="Enter a reason" className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900" />}
        </label>}
        {requester && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Reason: User requested cancellation</p>}
        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={saving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Keep Ride</button>
          <button type="button" onClick={() => void submitCancellation()} disabled={saving} className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{saving ? "Cancelling…" : requester ? "Cancel Request" : "Cancel Ride"}</button>
        </div>
      </section>
    </div>}
  </>;
}
