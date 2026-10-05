import { findRoleBySlug } from "@/lib/configStore";
import { cancelRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const roleSlug = request.headers.get("x-mobility-role")?.trim() ?? "";
    if (!roleSlug) return Response.json({ error: "A current role is required." }, { status: 403 });
    const role = await findRoleBySlug(roleSlug, false);
    if (!role) return Response.json({ error: "The active role could not be verified." }, { status: 403 });

    const body: unknown = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || !("reason" in body) || typeof body.reason !== "string" || !body.reason.trim() || !("actorName" in body) || typeof body.actorName !== "string" || !body.actorName.trim()) {
      return Response.json({ error: "Provide your name and a reason for cancelling this ride." }, { status: 400 });
    }
    const { id } = await context.params;
    const rideId = parseRideObjectId(id);
    if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });
    const ride = await cancelRide(rideId, { name: body.actorName, role: role.slug, category: role.category }, body.reason);
    return Response.json({ ride });
  } catch (error) {
    return rideActionError(error, "cancel ride");
  }
}
