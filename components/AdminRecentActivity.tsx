"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

interface EventRecord {
  id: string; action: string; actorName: string; actorRole: string;
  entityType: string; details: Record<string, string | number | boolean>; createdAt: string;
}

function describeEvent(event: EventRecord): string {
  const route = typeof event.details.from === "string" && typeof event.details.to === "string" ? `${event.details.from} → ${event.details.to}` : "";
  switch (event.action) {
    case "ride_created": return `requested a ride${route ? `: ${route}` : ""}`;
    case "ride_accepted": return `accepted a ride${route ? `: ${route}` : ""}`;
    case "ride_waitlisted": return `waitlisted a ride${route ? `: ${route}` : ""}`;
    case "ride_waitlist_promoted": return `made a waitlisted ride available${route ? `: ${route}` : ""}`;
    case "passenger_boarded": return `marked a passenger boarded${route ? `: ${route}` : ""}`;
    case "passenger_missed": return `marked a passenger missed${route ? `: ${route}` : ""}`;
    case "ride_completed": return `completed a ride${route ? `: ${route}` : ""}`;
    case "ride_cancelled": return `cancelled a ride${route ? `: ${route}` : ""}`;
    case "ride_archived": return `archived a completed trip${route ? `: ${route}` : ""}`;
    case "ride_restored": return `restored a trip${route ? `: ${route}` : ""}`;
    case "ride_deleted": return `permanently deleted an archived trip${route ? `: ${route}` : ""}`;
    case "location_added": return `added the location ${String(event.details.displayName ?? "")}`;
    case "location_disabled": return `disabled the location ${String(event.details.displayName ?? "")}`;
    case "location_enabled": return `enabled the location ${String(event.details.displayName ?? "")}`;
    case "role_added": return `added the requester role ${String(event.details.roleName ?? "")}`;
    case "role_disabled": return `disabled the role ${String(event.details.roleName ?? "")}`;
    case "role_enabled": return `enabled the role ${String(event.details.roleName ?? "")}`;
    case "settings_changed": return `updated mobility settings (capacity ${String(event.details.passengerCapacity ?? "")})`;
    case "user_created": return `created the account ${String(event.details.username ?? "")}`;
    case "user_disabled": return `disabled the account ${String(event.details.username ?? "")}`;
    case "user_enabled": return `enabled the account ${String(event.details.username ?? "")}`;
    case "user_role_changed": return `changed the role for ${String(event.details.username ?? "")}`;
    case "user_password_reset": return `reset the password for ${String(event.details.username ?? "")}`;
    default: return `performed ${event.action.replaceAll("_", " ")}`;
  }
}

export default function AdminRecentActivity() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/activity", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { events?: EventRecord[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load recent activity.");
        return result.events ?? [];
      })
      .then((loaded) => { if (active) { setEvents(loaded); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load recent activity."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section aria-labelledby="activity-heading" className="mb-9 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-center gap-2"><Activity aria-hidden="true" className="size-5 text-mobility-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit visibility</p><h2 id="activity-heading" className="mt-0.5 text-lg font-semibold text-slate-900">Recent activity</h2></div></div>
    {loading ? <p className="mt-4 text-sm text-slate-500" role="status">Loading activity…</p> : error ? <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p> : events.length === 0 ? <p className="mt-4 text-sm text-slate-500">No activity has been recorded yet.</p> : <ol className="mt-4 divide-y divide-slate-100">{events.map((event) => <li key={event.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"><p className="min-w-0 break-words text-sm text-slate-800"><span className="font-semibold text-slate-900">{event.actorName}</span> {describeEvent(event)}</p><time className="shrink-0 text-xs text-slate-500" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></li>)}</ol>}
  </section>;
}
