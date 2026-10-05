"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BusFront, BriefcaseBusiness, Check, GraduationCap, History, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { getUser, saveUser } from "@/lib/session";
import { getRoleHome, type UserRole } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";

const roles: { value: UserRole; label: string; description: string; icon: typeof GraduationCap }[] = [
  { value: "student", label: "Student", description: "Request campus rides", icon: GraduationCap },
  { value: "employee", label: "Employee", description: "Travel between campus locations", icon: BriefcaseBusiness },
  { value: "rider", label: "Rider", description: "Manage ride requests", icon: BusFront },
  { value: "admin", label: "Admin / Mobility Desk", description: "Monitor mobility operations", icon: ShieldCheck },
];

const features = [
  { icon: Zap, label: "Quick ride requests" },
  { icon: Sparkles, label: "Smart clash handling" },
  { icon: History, label: "Clear trip history" },
];

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getUser();
    if (user) router.replace(getRoleHome(user.role));
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
    router.replace(getRoleHome(role));
  }

  return (
    <main className="relative isolate flex min-h-screen flex-1 items-center overflow-hidden bg-slate-50 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6 lg:right-8">
        <ThemeToggle />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-mobility-100/70 blur-3xl sm:size-[28rem]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-[18%] -z-10 size-96 rounded-full bg-emerald-50 blur-3xl" />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.88fr)] lg:gap-12 xl:gap-16">
        <section aria-labelledby="hero-heading" className="mx-auto w-full max-w-2xl lg:mx-0">
          <div className="mb-5 flex items-center gap-3 pr-12 sm:mb-7 sm:pr-0">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mobility-600 text-white shadow-sm shadow-mobility-600/20">
              <BusFront aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-slate-950">Internal Mobility Desk</p>
              <p className="mt-0.5 text-xs text-slate-500">Simple campus transport coordination</p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-mobility-800 sm:text-sm">Campus mobility, made simple</p>
            <h1 id="hero-heading" className="text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.7rem] lg:leading-[1.12]">
              Campus rides, <span className="text-mobility-700">coordinated simply.</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">
              Request, manage and track shared campus rides between your key locations.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-mobility-700 ring-1 ring-mobility-200">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="relative mt-5 overflow-hidden rounded-2xl border border-mobility-200 bg-white p-3 shadow-sm sm:mt-7 sm:p-5 lg:mt-8">
            <div aria-hidden="true" className="absolute -right-8 -top-12 size-40 rounded-full bg-mobility-50" />
            <div className="relative h-36 w-full sm:h-48">
              <svg aria-hidden="true" viewBox="0 0 620 230" className="login-route-illustration h-full w-full" fill="none" role="presentation">
                <path d="M74 158C160 158 160 72 265 72S368 168 472 168" stroke="var(--route-line)" strokeWidth="8" strokeLinecap="round" strokeDasharray="2 18" />
                <path d="M74 158C160 158 160 72 265 72S368 168 472 168" stroke="var(--route-accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 18" />
                <circle cx="74" cy="158" r="15" fill="var(--route-node)" stroke="var(--route-accent)" strokeWidth="5" />
                <circle cx="265" cy="72" r="15" fill="var(--route-node)" stroke="var(--route-accent)" strokeWidth="5" />
                <circle cx="472" cy="168" r="15" fill="var(--route-node)" stroke="var(--route-accent)" strokeWidth="5" />
                <circle cx="74" cy="158" r="5" fill="var(--route-node-center)" />
                <circle cx="265" cy="72" r="5" fill="var(--route-node-center)" />
                <circle cx="472" cy="168" r="5" fill="var(--route-node-center)" />
                <g transform="translate(310 107)">
                  <ellipse cx="0" cy="47" rx="50" ry="8" fill="var(--route-shadow)" />
                  <path d="M-42 8h53c7 0 13 5 15 12l5 18h-78V17c0-5 2-9 5-9Z" fill="var(--route-vehicle)" />
                  <path d="M-14 10h23l6 18h-29V10Z" fill="var(--route-window)" />
                  <path d="M-39 31h68v7h-68z" fill="var(--route-trim)" />
                  <path d="M-31 1h42" stroke="var(--route-trim)" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="-25" cy="39" r="9" fill="var(--route-wheel)" />
                  <circle cx="16" cy="39" r="9" fill="var(--route-wheel)" />
                  <circle cx="-25" cy="39" r="3" fill="var(--route-wheel-center)" />
                  <circle cx="16" cy="39" r="3" fill="var(--route-wheel-center)" />
                  <path d="M-48 17h9" stroke="var(--route-wheel-center)" strokeWidth="4" strokeLinecap="round" />
                </g>
              </svg>
            </div>
            <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500 sm:pt-4 sm:text-sm">
              <span>One Toto. Shared rides.</span>
              <span className="inline-flex items-center gap-1.5 text-mobility-800"><span aria-hidden="true" className="size-2 rounded-full bg-mobility-500" /> Flexible pickup &amp; drop points</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="login-heading" className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_-32px_rgba(23,34,27,0.3)] sm:p-7 lg:max-w-none lg:p-8 xl:p-9">
          <div className="mb-5 sm:mb-6">
            <p className="text-sm font-semibold text-mobility-800">Welcome</p>
            <h2 id="login-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.7rem]">Get started</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enter your name and choose how you’ll use the mobility desk.</p>
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
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none placeholder:text-slate-400 transition-[border-color,box-shadow] duration-150 focus:border-mobility-600 focus:ring-4 focus:ring-mobility-600/10"
              aria-describedby={error ? "login-error" : undefined}
            />

            <fieldset className="mt-5 sm:mt-6">
              <legend className="mb-3 text-sm font-semibold text-slate-800">I’m here as a</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {roles.map(({ value, label, description, icon: Icon }) => {
                  const selected = role === value;
                  return (
                    <label
                      key={value}
                      className={`group flex min-h-[4.6rem] cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-[border-color,background-color,box-shadow] duration-150 focus-within:ring-2 focus-within:ring-mobility-600 focus-within:ring-offset-1 sm:items-center sm:gap-3 sm:p-3.5 ${
                        selected
                          ? "border-mobility-500 bg-mobility-50 text-mobility-800 shadow-sm shadow-mobility-500/5"
                          : "border-slate-200 bg-white hover:border-mobility-300 hover:bg-mobility-50/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={selected}
                        onChange={() => setRole(value)}
                        className="mt-1 size-4 shrink-0 accent-mobility-600 sm:mt-0"
                      />
                      <span className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-150 ${selected ? "bg-white text-mobility-700" : "bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-mobility-700"}`}>
                        <Icon aria-hidden="true" className="size-[1.125rem]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-5 text-slate-900">{label}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-slate-500">{description}</span>
                      </span>
                      {selected && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mobility-700 sm:mt-0" />}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {error && <p id="login-error" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700" role="alert">{error}</p>}

            <button
              type="submit"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-mobility-600 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-mobility-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mobility-600/20 sm:mt-6"
            >
              Continue
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">No password needed for this demo.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
