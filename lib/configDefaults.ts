import type { RoleCategory } from "@/lib/types";

export const DEFAULT_ROLES: Array<{
  name: string;
  slug: string;
  category: RoleCategory;
}> = [
  { name: "Student", slug: "student", category: "requester" },
  { name: "Employee", slug: "employee", category: "requester" },
  { name: "Rider", slug: "rider", category: "rider" },
  { name: "Admin / Mobility Desk", slug: "admin", category: "admin" },
];

export const DEFAULT_LOCATIONS = ["College", "Station", "Office"];

export const DEFAULT_VEHICLE_NAME = "Toto";
export const DEFAULT_PASSENGER_CAPACITY = 5;
