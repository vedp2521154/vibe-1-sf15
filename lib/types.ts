export type UserRole = "student" | "employee" | "rider";

export interface SessionUser {
  name: string;
  role: UserRole;
}

export type RideStatus = "pending" | "accepted" | "clash" | "completed";

export type PickupStatus = "pending" | "boarded" | "missed";

export type LocationName = "College" | "Station" | "Office";

export interface Passenger {
  name: string;
  pickupStatus: PickupStatus;
}

export interface Ride {
  _id?: string;
  requestedBy: {
    name: string;
    role: "student" | "employee";
  };
  from: LocationName;
  to: LocationName;
  scheduledAt: string;
  passengers: Passenger[];
  status: RideStatus;
  createdAt: string;
  completedAt?: string | null;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "student" || value === "employee" || value === "rider";
}

export function isLocationName(value: unknown): value is LocationName {
  return value === "College" || value === "Station" || value === "Office";
}
