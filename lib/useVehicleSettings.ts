"use client";

import { useEffect, useState } from "react";

interface VehicleResponse { settings?: { vehicleName?: string }; }

export function useVehicleName(): string {
  const [name, setName] = useState("Toto");
  useEffect(() => {
    let active = true;
    fetch("/api/config/settings", { cache: "no-store" })
      .then((response) => response.json() as Promise<VehicleResponse>)
      .then((result) => { if (active && result.settings?.vehicleName) setName(result.settings.vehicleName); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return name;
}
