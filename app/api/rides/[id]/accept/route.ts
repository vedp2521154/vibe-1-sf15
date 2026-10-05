import { acceptRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";
import { requireApiUser } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/rides/[id]/accept">) {
  const auth = await requireApiUser(request, ["rider", "admin"]);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });

  try {
    const ride = await acceptRide(rideId, { userId: auth.user.id, name: auth.user.name, role: auth.user.role });
    return Response.json({ ride, message: ride.status === "waitlisted" ? "This request overlaps a confirmed ride and was added to the waitlist." : undefined });
  } catch (error) {
    return rideActionError(error, "accept");
  }
}
