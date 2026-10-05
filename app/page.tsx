"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadServerSession } from "@/lib/session";
import { getRoleHome } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    void loadServerSession(true).then((user) => {
      router.replace(user ? getRoleHome(user.role, user.category) : "/login");
    });
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-sm font-medium text-slate-500" role="status">Opening your workspace…</p>
    </main>
  );
}
