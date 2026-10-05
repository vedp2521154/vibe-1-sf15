import { requireApiUser } from "@/lib/auth/server";
import { parseRideObjectId, rideActionError, setRideArchived } from "@/lib/ridesStore";
import { recordActivity } from "@/lib/operationalEvents";

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
    const ride = await setRideArchived(rideId, body.archived);
    await recordActivity({ action: body.archived ? "ride_archived" : "ride_restored", actor: { userId: auth.user.id, name: auth.user.name, role: auth.user.role }, entityType: "ride", entityId: ride._id, details: { from: ride.from, to: ride.to } });
    return Response.json({ ride });
  } catch (error) {
    return rideActionError(error, "update trip archive");
  }
}
