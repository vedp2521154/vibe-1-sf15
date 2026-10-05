import { requireApiUser } from "@/lib/auth/server";
import { permanentlyDeleteArchivedRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";
import { recordActivity } from "@/lib/operationalEvents";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(request, ["admin"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const rideId = parseRideObjectId(id);
    if (!rideId) return Response.json({ error: "Ride record not found." }, { status: 404 });
    const ride = await permanentlyDeleteArchivedRide(rideId);
    await recordActivity({ action: "ride_deleted", actor: { userId: auth.user.id, name: auth.user.name, role: auth.user.role }, entityType: "ride", entityId: ride._id, details: { from: ride.from, to: ride.to } });
    return Response.json({ success: true });
  } catch (error) {
    return rideActionError(error, "delete trip");
  }
}
