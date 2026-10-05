import { requestUsesAdminRole } from "@/lib/adminAuthorization";
import { permanentlyDeleteArchivedRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requestUsesAdminRole(request))) return Response.json({ error: "Only Admin can permanently delete archived trips." }, { status: 403 });
    const { id } = await context.params;
    const rideId = parseRideObjectId(id);
    if (!rideId) return Response.json({ error: "Ride record not found." }, { status: 404 });
    await permanentlyDeleteArchivedRide(rideId);
    return Response.json({ success: true });
  } catch (error) {
    return rideActionError(error, "delete trip");
  }
}
