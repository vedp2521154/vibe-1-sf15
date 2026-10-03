"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    router.replace(user.role === "rider" ? "/rider" : "/request");
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-sm font-medium text-slate-500" role="status">Opening your workspace…</p>
    </main>
  );
}
