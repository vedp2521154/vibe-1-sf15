export type UserRole = "student" | "employee" | "rider" | "admin";

export type RoleCategory = "REQUESTER" | "RIDER" | "ADMIN";

export function getRoleCategory(role: UserRole): RoleCategory {
  if (role === "student" || role === "employee") return "REQUESTER";
  if (role === "rider") return "RIDER";
  return "ADMIN";
}

export function isRequester(role: unknown): role is "student" | "employee" {
  return role === "student" || role === "employee";
}

export function isRider(role: unknown): role is "rider" {
  return role === "rider";
}

export function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

export function isOperationalRole(role: unknown): role is "rider" | "admin" {
  return isRider(role) || isAdmin(role);
}

export function getRoleHome(role: UserRole): string {
  if (isAdmin(role)) return "/admin";
  if (isRider(role)) return "/rider";
  return "/request";
}

export function getRoleLabel(role: UserRole): string {
  if (isAdmin(role)) return "Admin / Mobility Desk";
  if (isRider(role)) return "Rider";
  if (role === "employee") return "Employee";
  return "Student";
}

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
  return isRequester(value) || isRider(value) || isAdmin(value);
}

export function isLocationName(value: unknown): value is LocationName {
  return value === "College" || value === "Station" || value === "Office";
}
