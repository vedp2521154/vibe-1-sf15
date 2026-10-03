"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BusFront, BriefcaseBusiness, GraduationCap } from "lucide-react";
import { getUser, saveUser } from "@/lib/session";
import type { UserRole } from "@/lib/types";

const roles: { value: UserRole; label: string; description: string; icon: typeof GraduationCap }[] = [
  { value: "student", label: "Student", description: "Request a ride to campus", icon: GraduationCap },
  { value: "employee", label: "Employee", description: "Travel to your workplace", icon: BriefcaseBusiness },
  { value: "rider", label: "Rider", description: "Manage ride requests", icon: BusFront },
];

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (user) router.replace(user.role === "rider" ? "/rider" : "/request");
  }, [router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    if (!role) {
      setError("Please choose a role to continue.");
      return;
    }

    saveUser({ name: trimmedName, role });
    router.replace(role === "rider" ? "/rider" : "/request");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-mobility-600 text-white">
            <BusFront aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-950">Internal Mobility Desk</p>
            <p className="mt-0.5 text-xs text-slate-500">Simple campus transport coordination</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-mobility-800">Welcome</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Get started</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Enter your name and choose how you’ll use the desk.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-800">Your name</label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Aanya Sharma"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
            aria-describedby={error ? "login-error" : undefined}
          />

          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-semibold text-slate-800">I’m here as a</legend>
            <div className="grid gap-2.5">
              {roles.map(({ value, label, description, icon: Icon }) => {
                const selected = role === value;
                return (
                  <label
                    key={value}
                    className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors focus-within:ring-2 focus-within:ring-mobility-600 focus-within:ring-offset-1 ${
                      selected
                        ? "border-mobility-600 bg-mobility-50/60"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={selected}
                      onChange={() => setRole(value)}
                      className="size-4 shrink-0 accent-mobility-600"
                    />
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${selected ? "bg-mobility-100 text-mobility-700" : "bg-slate-100 text-slate-600"}`}>
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && <p id="login-error" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700" role="alert">{error}</p>}

          <button
            type="submit"
            className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-mobility-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-mobility-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mobility-600/20"
          >
            Continue
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">No password needed to get started.</p>
        </form>
        <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">College <span aria-hidden="true">·</span> Station <span aria-hidden="true">·</span> Office</p>
      </section>
    </main>
  );
}
