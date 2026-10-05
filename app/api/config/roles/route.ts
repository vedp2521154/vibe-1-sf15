import { addRequesterRole, listRoles } from "@/lib/configStore";

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
    return Response.json({ roles: await listRoles(includeInactive) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("name" in body) || typeof body.name !== "string" || !body.name.trim()) {
      return Response.json({ error: "Enter a role name." }, { status: 400 });
    }
    if (body.name.trim().length > 50) return Response.json({ error: "Role names must be 50 characters or fewer." }, { status: 400 });
    return Response.json({ role: await addRequesterRole(body.name) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
