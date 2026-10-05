import { addRequesterRole, listRoles } from "@/lib/configStore";
import { requireApiUser } from "@/lib/auth/server";
import { recordActivity } from "@/lib/operationalEvents";

function errorResponse(error: unknown) {
  if (error instanceof Error && (error.message.includes("already exists") || error.message.includes("required"))) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  console.error("Role configuration failed:", error);
  return Response.json({ error: "Could not access role settings. Check the MongoDB connection." }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    if (includeInactive) {
      const auth = await requireApiUser(request, ["admin"]);
      if (auth.response) return auth.response;
    }
    return Response.json({ roles: await listRoles(includeInactive) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("name" in body) || typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "Enter a role name." }, { status: 400 });
    }
    if (body.name.trim().length > 50) return Response.json({ error: "Role names must be 50 characters or fewer." }, { status: 400 });
    const role = await addRequesterRole(body.name);
    await recordActivity({ action: "role_added", actor: { userId: auth.user.id, name: auth.user.name, role: auth.user.role }, entityType: "role", entityId: role._id, details: { roleName: role.name, role: role.slug } });
    return Response.json({ role }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
