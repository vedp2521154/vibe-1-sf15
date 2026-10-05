"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AuthGuard from "@/components/AuthGuard";
import type { RoleConfig } from "@/lib/configStore";

interface ManagedUser { id: string; username: string; displayName: string; roleSlug: string; roleName: string; roleCategory: string; active: boolean; createdAt: string }
interface ApiResult { error?: string; users?: ManagedUser[]; roles?: RoleConfig[]; user?: { id: string } }

async function callApi(path: string, init?: RequestInit): Promise<ApiResult> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const data = await response.json() as ApiResult;
  if (!response.ok) throw new Error(data.error ?? "User account operation failed.");
  return data;
}

function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [userData, roleData] = await Promise.all([callApi("/api/admin/users"), callApi("/api/config/roles")]);
    setUsers(userData.users ?? []); setRoles(roleData.roles ?? []);
    setRoleSlug((current) => current || roleData.roles?.[0]?.slug || "");
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([callApi("/api/admin/users"), callApi("/api/config/roles")])
      .then(([userData, roleData]) => {
        if (!active) return;
        setUsers(userData.users ?? []); setRoles(roleData.roles ?? []);
        setRoleSlug((current) => current || roleData.roles?.[0]?.slug || "");
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load accounts."); });
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await refresh(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "User account operation failed."); }
    finally { setBusy(false); }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await callApi("/api/admin/users", { method: "POST", body: JSON.stringify({ displayName, username, password, roleSlug }) });
      setDisplayName(""); setUsername(""); setPassword("");
    }, "User account created.");
  }

  const inputClass = "mt-1.5 h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900";
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-mobility-700">Administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">User accounts</h1><p className="mt-2 text-sm text-slate-600">Create operational accounts, assign active roles, disable access, and reset passwords.</p></div><a href="/admin" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Admin dashboard</a></div>
    {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
    {notice && <p className="mb-4 rounded-xl border border-mobility-200 bg-mobility-50 px-4 py-3 text-sm text-mobility-800" role="status">{notice}</p>}
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">Create an account</h2>
      <form onSubmit={createAccount} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="text-sm font-semibold text-slate-700">Display name<input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} /></label>
        <label className="text-sm font-semibold text-slate-700">Username<input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} autoComplete="off" /></label>
        <label className="text-sm font-semibold text-slate-700">Temporary password<input className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={10} autoComplete="new-password" /></label>
        <div className="flex gap-2"><label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">Role<select className={inputClass} value={roleSlug} onChange={(event) => setRoleSlug(event.target.value)} required><option value="" disabled>Select role</option>{roles.map((role) => <option key={role.slug} value={role.slug}>{role.name} · {role.category}</option>)}</select></label><button className="mt-auto h-11 rounded-lg bg-mobility-600 px-4 text-sm font-semibold text-white hover:bg-mobility-700 disabled:opacity-50" disabled={busy || !roles.length}>Create</button></div>
      </form>
      <p className="mt-3 text-xs text-slate-500">Passwords must be at least 10 characters. Share temporary passwords securely.</p>
    </section>
    <section aria-labelledby="users-heading">
      <h2 id="users-heading" className="mb-3 text-lg font-bold text-slate-950">Accounts ({users.length})</h2>
      <div className="grid gap-3">
        {users.map((user) => <article key={user.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold text-slate-900">{user.displayName}</h3><p className="mt-0.5 break-all text-sm text-slate-500">@{user.username}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? "bg-mobility-50 text-mobility-800" : "bg-slate-100 text-slate-600"}`}>{user.active ? "Active" : "Disabled"}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="text-xs font-semibold text-slate-600">Assigned role<select className={inputClass} value={user.roleSlug} onChange={(event) => void run(async () => { await callApi(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ roleSlug: event.target.value }) }); }, "User role updated.")} disabled={busy}><option value={user.roleSlug}>{user.roleName} · {user.roleCategory}</option>{roles.filter((role) => role.slug !== user.roleSlug).map((role) => <option key={role.slug} value={role.slug}>{role.name} · {role.category}</option>)}</select></label>
            <button type="button" disabled={busy} onClick={() => void run(async () => { await callApi(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ active: !user.active }) }); }, user.active ? "Account disabled." : "Account enabled.")} className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{user.active ? "Disable account" : "Enable account"}</button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); const nextPassword = resetPasswords[user.id] ?? ""; void run(async () => { await callApi(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ password: nextPassword }) }); setResetPasswords((current) => ({ ...current, [user.id]: "" })); }, "Password reset."); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" type="password" autoComplete="new-password" minLength={10} placeholder="Set a new password (10+ characters)" value={resetPasswords[user.id] ?? ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [user.id]: event.target.value }))} required />
            <button className="h-11 shrink-0 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={busy}>Reset password</button>
          </form>
        </article>)}
        {!users.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No user accounts yet.</div>}
      </div>
    </section>
  </main>;
}

export default function AdminUsersPage() { return <AuthGuard allowedFor="admin"><UserManagement /></AuthGuard>; }
