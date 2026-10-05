export type UserRole = string;

export type RoleCategory = "requester" | "rider" | "admin";

export function isRoleCategory(value: unknown): value is RoleCategory {
  return value === "requester" || value === "rider" || value === "admin";
}

export function getBuiltInRoleCategory(role: unknown): RoleCategory | null {
  if (role === "student" || role === "employee") return "requester";
  if (role === "rider") return "rider";
  if (role === "admin") return "admin";
  return null;
}

export function getRoleCategory(role: string, category?: RoleCategory): RoleCategory {
  return category ?? getBuiltInRoleCategory(role) ?? "requester";
}

export function isRequester(role: unknown, category?: RoleCategory): boolean {
  return typeof role === "string" && getRoleCategory(role, category) === "requester";
}

export function isRider(role: unknown, category?: RoleCategory): boolean {
  return typeof role === "string" && getRoleCategory(role, category) === "rider";
}

export function isAdmin(role: unknown, category?: RoleCategory): boolean {
  return typeof role === "string" && getRoleCategory(role, category) === "admin";
}

export function isOperationalRole(role: unknown, category?: RoleCategory): boolean {
  return isRider(role, category) || isAdmin(role, category);
}

export function getRoleHome(role: string, category?: RoleCategory): string {
  const roleCategory = getRoleCategory(role, category);
  if (roleCategory === "admin") return "/admin";
  if (roleCategory === "rider") return "/rider";
  return "/request";
}

export function getRoleLabel(role: string, category?: RoleCategory, roleName?: string): string {
  if (roleName?.trim()) return roleName.trim();
  if (role === "admin" || category === "admin") return "Admin / Mobility Desk";
  if (role === "rider" || category === "rider") return "Rider";
  if (role === "employee") return "Employee";
  if (role === "student") return "Student";
  return role;
}

export interface SessionUser {
  name: string;
  role: UserRole;
  category: RoleCategory;
  roleName: string;
}

export type RideStatus = "pending" | "accepted" | "waitlisted" | "clash" | "completed" | "cancelled";

export type PickupStatus = "pending" | "boarded" | "missed";

export type LocationName = string;

export interface Passenger {
  name: string;
  pickupStatus: PickupStatus;
}

export interface Ride {
  _id?: string;
  requestedBy: {
    name: string;
    role: string;
  };
  from: LocationName;
  to: LocationName;
  scheduledAt: string;
  passengers: Passenger[];
  status: RideStatus;
  createdAt: string;
  completedAt?: string | null;
  archived?: boolean;
  estimatedDurationMinutes?: number;
  estimatedEndAt?: string;
  cancelledAt?: string | null;
  cancelledBy?: { name: string; role: string } | null;
  cancellationReason?: string | null;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isLocationName(value: unknown): value is LocationName {
  return typeof value === "string" && value.trim().length > 0;
}
