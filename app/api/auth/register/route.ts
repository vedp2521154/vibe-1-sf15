import { createSession, createUser, AuthError, isSameOriginRequest, isValidUsername, MIN_PASSWORD_LENGTH, normalizeUsername, safeUser, sessionCookie } from "@/lib/auth/server";
import { findRoleBySlug } from "@/lib/configStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function duplicateUsername(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.displayName !== "string" || typeof body.username !== "string" || typeof body.password !== "string" || typeof body.confirmPassword !== "string" || typeof body.roleSlug !== "string") {
    return Response.json({ error: "Complete all registration fields." }, { status: 400 });
  }
  const displayName = body.displayName.trim();
  const username = normalizeUsername(body.username);
  if (!displayName || displayName.length > 80) return Response.json({ error: "Enter a display name up to 80 characters." }, { status: 400 });
  if (!isValidUsername(username)) return Response.json({ error: "Username must be 3–32 characters: lowercase letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
  if (body.password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  if (body.password !== body.confirmPassword) return Response.json({ error: "Passwords do not match." }, { status: 400 });

  try {
    const role = await findRoleBySlug(body.roleSlug, false);
    if (!role || role.category !== "requester") return Response.json({ error: "Registration is available only for active requester roles." }, { status: 403 });
    const user = await createUser({ username, displayName, password: body.password, roleSlug: role.slug });
    const session = await createSession(user.id);
    return Response.json({ user: safeUser(user) }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt), "Cache-Control": "no-store" } });
  } catch (error) {
    if (duplicateUsername(error)) return Response.json({ error: "That username is already taken." }, { status: 409 });
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Requester registration failed:", error);
    return Response.json({ error: "Registration is temporarily unavailable." }, { status: 503 });
  }
}
