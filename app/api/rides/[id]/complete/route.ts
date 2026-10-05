import { completeRide, parseRideObjectId, rideActionError } from "@/lib/ridesStore";
import { requireApiUser } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/rides/[id]/complete">) {
  const auth = await requireApiUser(request, ["rider", "admin"]);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const rideId = parseRideObjectId(id);
  if (!rideId) return Response.json({ error: "Ride request not found." }, { status: 404 });

  try {
    return Response.json({ ride: await completeRide(rideId, { userId: auth.user.id, name: auth.user.name, role: auth.user.role }) });
  } catch (error) {
    return rideActionError(error, "complete");
  }
}
