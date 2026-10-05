"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { loadServerSession, saveUser } from "@/lib/session";
import { getRoleHome, type SessionUser } from "@/lib/types";

interface RequesterRole { slug: string; name: string }

export default function RegisterPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RequesterRole[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadServerSession(true).then((user) => { if (user) router.replace(getRoleHome(user.role, user.category)); });
    void fetch("/api/auth/roles", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as { roles?: RequesterRole[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load requester roles.");
      setRoles(result.roles ?? []);
      setRoleSlug((current) => current || result.roles?.[0]?.slug || "");
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load requester roles."));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, username, roleSlug, password, confirmPassword }) });
      const result = await response.json() as { user?: SessionUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error ?? "Could not create your account.");
      saveUser(result.user);
      router.replace(getRoleHome(result.user.role, result.user.category));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your account."); }
    finally { setBusy(false); }
  }

  const inputClass = "mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10";
  return <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 sm:px-6">
    <div className="absolute right-4 top-4 sm:right-6 sm:top-6"><ThemeToggle /></div>
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <p className="text-sm font-semibold text-mobility-700">Internal Mobility Desk</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Create requester account</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Registration is available for requester roles. Rider and Admin accounts are created by an Admin.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-800">Display name<input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} required /></label>
        <label className="block text-sm font-semibold text-slate-800">Username<input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} required /><span className="mt-1 block text-xs font-normal text-slate-500">3–32 lowercase letters, numbers, dots, underscores, or hyphens.</span></label>
        <label className="block text-sm font-semibold text-slate-800">Requester role<select className={inputClass} value={roleSlug} onChange={(event) => setRoleSlug(event.target.value)} required disabled={!roles.length}><option value="" disabled>Select a role</option>{roles.map((role) => <option key={role.slug} value={role.slug}>{role.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-800">Password<input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={10} required /></label>
        <label className="block text-sm font-semibold text-slate-800">Confirm password<input className={inputClass} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={10} required /></label>
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">{error}</p>}
        <button className="h-12 w-full rounded-xl bg-mobility-600 px-4 text-sm font-semibold text-white hover:bg-mobility-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !roles.length}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="font-semibold text-mobility-700 hover:underline">Sign in</Link></p>
    </section>
  </main>;
}
