"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(media.matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
    const capturePrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    updateInstalled();
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", updateInstalled);
    media.addEventListener("change", updateInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", capturePrompt); window.removeEventListener("appinstalled", updateInstalled); media.removeEventListener("change", updateInstalled); };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  if (installed || !promptEvent) return null;
  return <button type="button" onClick={() => void install()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-mobility-600" aria-label="Install Mobility Desk app">
    <Download aria-hidden="true" className="size-4" /><span>Install App</span>
  </button>;
}
