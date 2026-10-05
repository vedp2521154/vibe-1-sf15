import { createUser, isValidUsername, listSafeUsers, MIN_PASSWORD_LENGTH, normalizeUsername, requireApiUser, safeUser } from "@/lib/auth/server";
import { findRoleBySlug } from "@/lib/configStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function duplicateUsername(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  try { return Response.json({ users: await listSafeUsers() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    console.error("User list failed:", error);
    return Response.json({ error: "Could not load user accounts." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.displayName !== "string" || typeof body.username !== "string" || typeof body.password !== "string" || typeof body.roleSlug !== "string") {
    return Response.json({ error: "Complete all user fields." }, { status: 400 });
  }
  const displayName = body.displayName.trim();
  const username = normalizeUsername(body.username);
  if (!displayName || displayName.length > 80) return Response.json({ error: "Enter a display name up to 80 characters." }, { status: 400 });
  if (!isValidUsername(username)) return Response.json({ error: "Username must be 3–32 characters: lowercase letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
  if (body.password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  try {
    const role = await findRoleBySlug(body.roleSlug, false);
    if (!role) return Response.json({ error: "Choose an active role." }, { status: 400 });
    const user = await createUser({ username, displayName, password: body.password, roleSlug: role.slug });
    return Response.json({ user: safeUser(user) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (duplicateUsername(error)) return Response.json({ error: "That username is already taken." }, { status: 409 });
    if (error instanceof Error && error.message === "The selected role is unavailable.") return Response.json({ error: "Choose an active role." }, { status: 400 });
    console.error("Admin user creation failed:", error);
    return Response.json({ error: "Could not create the user account." }, { status: 503 });
  }
}
