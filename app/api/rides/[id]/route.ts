import { requireApiUser } from "@/lib/auth/server";
import { permanentlyDeleteArchivedRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(request, ["admin"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const rideId = parseRideObjectId(id);
    if (!rideId) return Response.json({ error: "Ride record not found." }, { status: 404 });
    await permanentlyDeleteArchivedRide(rideId);
    return Response.json({ success: true });
  } catch (error) {
    return rideActionError(error, "delete trip");
  }
}
