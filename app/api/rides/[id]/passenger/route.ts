import {
  parseRideObjectId,
  rideActionError,
  updatePassengerPickupStatus,
} from "@/lib/ridesStore";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request, context: RouteContext<"/api/rides/[id]/passenger">) {
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !Number.isInteger(body.passengerIndex) ||
    (body.pickupStatus !== "boarded" && body.pickupStatus !== "missed")
  ) {
    return Response.json(
      { error: "Choose a passenger and set their status to boarded or missed." },
      { status: 400 },
    );
  }

  try {
    return Response.json({
      ride: await updatePassengerPickupStatus(
        rideId,
        body.passengerIndex as number,
        body.pickupStatus,
      ),
    });
  } catch (error) {
    return rideActionError(error, "update passenger status for the ride");
  }
}
