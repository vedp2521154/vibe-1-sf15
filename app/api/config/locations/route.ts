import { addLocation, listLocations } from "@/lib/configStore";

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message.includes("already exists")) return Response.json({ error: error.message }, { status: 409 });
  console.error("Location configuration failed:", error);
  return Response.json({ error: "Could not access location settings. Check the MongoDB connection." }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return Response.json({ locations: await listLocations(includeInactive) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("name" in body) || typeof body.name !== "string" || !body.name.trim()) return Response.json({ error: "Enter a location name." }, { status: 400 });
    if (body.name.trim().length > 80) return Response.json({ error: "Location names must be 80 characters or fewer." }, { status: 400 });
    return Response.json({ location: await addLocation(body.name) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
