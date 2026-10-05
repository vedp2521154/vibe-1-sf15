import { AuthError, MIN_PASSWORD_LENGTH, requireApiUser, updateManagedUser } from "@/lib/auth/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return Response.json({ error: "Provide an account change." }, { status: 400 });
  const changes: { active?: boolean; roleSlug?: string; password?: string } = {};
  if ("active" in body) {
    if (typeof body.active !== "boolean") return Response.json({ error: "Active must be true or false." }, { status: 400 });
    changes.active = body.active;
  }
  if ("roleSlug" in body) {
    if (typeof body.roleSlug !== "string") return Response.json({ error: "Choose a valid role." }, { status: 400 });
    changes.roleSlug = body.roleSlug;
  }
  if ("password" in body) {
    if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) return Response.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
    changes.password = body.password;
  }
  if (!Object.keys(changes).length) return Response.json({ error: "Provide active, roleSlug, or password." }, { status: 400 });
  try {
    const { id } = await context.params;
    await updateManagedUser(id, changes);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Admin user update failed:", error);
    return Response.json({ error: "Could not update this user account." }, { status: 503 });
  }
}
