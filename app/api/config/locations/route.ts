import { addLocation, listLocations } from "@/lib/configStore";
import { requireApiUser } from "@/lib/auth/server";
import { recordActivity } from "@/lib/operationalEvents";

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message.includes("already exists")) return Response.json({ error: error.message }, { status: 409 });
  console.error("Location configuration failed:", error);
  return Response.json({ error: "Could not access location settings. Check the MongoDB connection." }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    const auth = await requireApiUser(request, includeInactive ? ["admin"] : undefined);
    if (auth.response) return auth.response;
    return Response.json({ locations: await listLocations(includeInactive) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("name" in body) || typeof body.name !== "string" || !body.name.trim()) return Response.json({ error: "Enter a location name." }, { status: 400 });
    if (body.name.trim().length > 80) return Response.json({ error: "Location names must be 80 characters or fewer." }, { status: 400 });
    const location = await addLocation(body.name);
    await recordActivity({ action: "location_added", actor: { userId: auth.user.id, name: auth.user.name, role: auth.user.role }, entityType: "location", entityId: location._id, details: { displayName: location.name } });
    return Response.json({ location }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
