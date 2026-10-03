import { acceptRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/rides/[id]/accept">) {
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });

  try {
    return Response.json({ ride: await acceptRide(rideId) });
  } catch (error) {
    return rideActionError(error, "accept");
  }
}
