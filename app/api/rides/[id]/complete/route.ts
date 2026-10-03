import { completeRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/rides/[id]/complete">) {
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });

  try {
    return Response.json({ ride: await completeRide(rideId) });
  } catch (error) {
    return rideActionError(error, "complete");
  }
}
