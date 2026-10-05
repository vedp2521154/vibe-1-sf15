import { requireApiUser } from "@/lib/auth/server";
import { cancelRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export async function POST(request: Request, context: RouteContext<"/api/rides/[id]/cancel">) {
  const auth = await requireApiUser(request, ["requester", "rider", "admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("reason" in body) || typeof body.reason !== "string") return Response.json({ error: "Provide a reason for cancelling this ride." }, { status: 400 });
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });
  try {
    const ride = await cancelRide(rideId, { userId: auth.user.id, name: auth.user.name, role: auth.user.role, category: auth.user.category }, body.reason);
    return Response.json({ ride });
  } catch (error) { return rideActionError(error, "cancel ride"); }
}
