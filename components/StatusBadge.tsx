import type { PickupStatus, RideStatus } from "@/lib/types";

const rideStyles: Record<RideStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  accepted: "bg-mobility-50 text-mobility-800 ring-mobility-200",
  clash: "bg-rose-50 text-rose-800 ring-rose-200",
  completed: "bg-mobility-50 text-mobility-800 ring-mobility-200",
};

const passengerStyles: Record<PickupStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  boarded: "bg-mobility-50 text-mobility-800 ring-mobility-200",
  missed: "bg-rose-50 text-rose-800 ring-rose-200",
};

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${rideStyles[status]}`}>
      {label(status)}
    </span>
  );
}

export function PassengerStatusBadge({ status }: { status: PickupStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${passengerStyles[status]}`}>
      {label(status)}
    </span>
  );
}
