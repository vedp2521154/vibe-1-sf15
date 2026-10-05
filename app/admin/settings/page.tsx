"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import type { LocationConfig, MobilitySettings, RoleConfig } from "@/lib/configStore";

interface ResponseBody { error?: string; roles?: RoleConfig[]; locations?: LocationConfig[]; settings?: MobilitySettings; role?: RoleConfig; location?: LocationConfig }

async function callApi(path: string, init?: RequestInit): Promise<ResponseBody> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json() as ResponseBody;
  if (!response.ok) throw new Error(data.error ?? "Could not save configuration.");
  return data;
}

function SettingsContent() {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [vehicleName, setVehicleName] = useState("Toto");
  const [passengerCapacity, setPassengerCapacity] = useState(5);
  const [roleName, setRoleName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [roleData, locationData, settingsData] = await Promise.all([
      callApi("/api/config/roles?includeInactive=true"),
      callApi("/api/config/locations?includeInactive=true"),
      callApi("/api/config/settings"),
    ]);
    setRoles(roleData.roles ?? []);
    setLocations(locationData.locations ?? []);
    setVehicleName(settingsData.settings?.vehicleName ?? "Toto");
    setPassengerCapacity(settingsData.settings?.passengerCapacity ?? 5);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([callApi("/api/config/roles?includeInactive=true"), callApi("/api/config/locations?includeInactive=true"), callApi("/api/config/settings")])
      .then(([roleData, locationData, settingsData]) => {
        if (!active) return;
        setRoles(roleData.roles ?? []);
        setLocations(locationData.locations ?? []);
        setVehicleName(settingsData.settings?.vehicleName ?? "Toto");
        setPassengerCapacity(settingsData.settings?.passengerCapacity ?? 5);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load settings."); });
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save configuration."); }
    finally { setBusy(false); }
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => { await callApi("/api/config/settings", { method: "PATCH", body: JSON.stringify({ vehicleName, passengerCapacity }) }); setNotice("Vehicle settings saved."); });
  }
  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => { await callApi("/api/config/roles", { method: "POST", body: JSON.stringify({ name: roleName }) }); setRoleName(""); setNotice("Requester role added."); });
  }
  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => { await callApi("/api/config/locations", { method: "POST", body: JSON.stringify({ name: locationName }) }); setLocationName(""); setNotice("Location added."); });
  }

  return <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-7"><p className="text-sm font-semibold text-mobility-700">Administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Mobility settings</h1><p className="mt-2 text-sm text-slate-600">Manage requester roles, locations, and vehicle capacity.</p></div>
    {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
    {notice && <p className="mb-4 rounded-xl border border-mobility-200 bg-mobility-50 px-4 py-3 text-sm text-mobility-800" role="status">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2"><h2 className="text-lg font-bold text-slate-950">Vehicle</h2><form onSubmit={saveVehicle} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold text-slate-700">Vehicle name<input value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} maxLength={40} required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-900" /></label>
        <label className="text-sm font-semibold text-slate-700">Passenger capacity<input type="number" min={1} max={20} step={1} value={passengerCapacity} onChange={(e) => setPassengerCapacity(Number(e.target.value))} required className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-900" /></label>
        <button disabled={busy} className="h-11 rounded-lg bg-mobility-600 px-5 text-sm font-semibold text-white hover:bg-mobility-700 disabled:opacity-60">Save</button>
      </form></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-slate-950">Requester roles</h2><p className="mt-1 text-sm text-slate-500">Built-in operational roles stay fixed. Added roles can request rides.</p><form onSubmit={createRole} className="mt-4 flex gap-2"><input value={roleName} onChange={(e) => setRoleName(e.target.value)} maxLength={50} placeholder="e.g. Visitor" required className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" /><button disabled={busy} className="rounded-lg bg-mobility-600 px-4 text-sm font-semibold text-white disabled:opacity-60">Add</button></form><ul className="mt-4 divide-y divide-slate-100">{roles.map((role) => <li key={role._id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{role.name}</p><p className="text-xs text-slate-500">{role.builtIn ? "Built-in" : "Requester"} · {role.active ? "Active" : "Inactive"}</p></div>{!role.builtIn && <button disabled={busy} onClick={() => void run(async () => { await callApi(`/api/config/roles/${role._id}`, { method: "PATCH", body: JSON.stringify({ active: !role.active }) }); setNotice("Role status updated."); })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">{role.active ? "Disable" : "Enable"}</button>}</li>)}</ul></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold text-slate-950">Locations</h2><p className="mt-1 text-sm text-slate-500">Inactive locations remain in existing ride history.</p><form onSubmit={createLocation} className="mt-4 flex gap-2"><input value={locationName} onChange={(e) => setLocationName(e.target.value)} maxLength={80} placeholder="Add pickup or drop point" required className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" /><button disabled={busy} className="rounded-lg bg-mobility-600 px-4 text-sm font-semibold text-white disabled:opacity-60">Add</button></form><ul className="mt-4 divide-y divide-slate-100">{locations.map((location) => <li key={location._id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{location.name}</p><p className="text-xs text-slate-500">{location.builtIn ? "Built-in" : "Custom"} · {location.active ? "Active" : "Inactive"}</p></div><button disabled={busy} onClick={() => void run(async () => { await callApi(`/api/config/locations/${location._id}`, { method: "PATCH", body: JSON.stringify({ active: !location.active }) }); setNotice("Location status updated."); })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">{location.active ? "Disable" : "Enable"}</button></li>)}</ul></section>
    </div>
  </main>;
}

export default function AdminSettingsPage() { return <AuthGuard allowedFor="admin"><SettingsContent /></AuthGuard>; }
