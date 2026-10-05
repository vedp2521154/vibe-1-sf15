import { acceptRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/rides/[id]/accept">) {
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });

  try {
    const ride = await acceptRide(rideId);
    return Response.json({ ride, message: ride.status === "waitlisted" ? "This request overlaps a confirmed ride and was added to the waitlist." : undefined });
  } catch (error) {
    return rideActionError(error, "accept");
  }
}
