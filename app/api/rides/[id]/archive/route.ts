import { requireApiUser } from "@/lib/auth/server";
import { parseRideObjectId, rideActionError, setRideArchived } from "@/lib/ridesStore";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(request, ["admin"]);
    if (auth.response) return auth.response;
    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || !("archived" in body) || typeof body.archived !== "boolean") {
      return Response.json({ error: "Provide archived as true or false." }, { status: 400 });
    }
    const { id } = await context.params;
    const rideId = parseRideObjectId(id);
    if (!rideId) return Response.json({ error: "Ride record not found." }, { status: 404 });
    return Response.json({ ride: await setRideArchived(rideId, body.archived) });
  } catch (error) {
    return rideActionError(error, "update trip archive");
  }
}
