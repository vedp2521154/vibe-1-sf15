import { findRoleBySlug } from "@/lib/configStore";

// This follows the app's existing demo session model. It identifies the submitted role,
// but is not a substitute for authenticated server sessions.
export async function requestUsesAdminRole(request: Request): Promise<boolean> {
  const slug = request.headers.get("x-mobility-role");
  if (!slug) return false;
  const role = await findRoleBySlug(slug, false);
  return role?.category === "admin";
}
