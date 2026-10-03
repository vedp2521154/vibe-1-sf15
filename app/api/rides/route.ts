import { getDatabase } from "@/lib/mongodb";
import { listCompletedRides, listRiderRides, rideActionError } from "@/lib/ridesStore";
import { isLocationName, type Ride } from "@/lib/types";

type RequesterRole = Ride["requestedBy"]["role"];
type StoredRide = Omit<Ride, "_id">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequesterRole(value: unknown): value is RequesterRole {
  return value === "student" || value === "employee";
}

function isValidScheduledAt(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function databaseErrorResponse(error: unknown, action: "fetch" | "create"): Response {
  console.error(`Ride ${action} failed:`, error);

  const missingConfiguration =
    error instanceof Error &&
    (error.message === "MONGODB_URI is not configured." ||
      error.message === "MONGODB_DB is not configured.");
  const message = missingConfiguration
    ? action === "create"
      ? "Your request was not saved. Set MONGODB_URI and MONGODB_DB in .env.local, then restart the server."
      : "Your requests cannot load yet. Set MONGODB_URI and MONGODB_DB in .env.local, then restart the server."
    : action === "create"
      ? "Your request was not saved. Check the MongoDB Atlas connection and try again."
      : "Could not load your requests. Check the MongoDB Atlas connection and try again.";

  return Response.json(
    { error: message },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("view") === "rider") {
    try {
      return Response.json({ rides: await listRiderRides() });
    } catch (error) {
      return rideActionError(error, "load ride requests");
    }
  }

  if (searchParams.get("view") === "history") {
    const historyRole = searchParams.get("role");
    if (historyRole === "rider") {
      try {
        return Response.json({ rides: await listCompletedRides() });
      } catch (error) {
        return rideActionError(error, "load ride history");
      }
    }

    if (historyRole !== "student" && historyRole !== "employee") {
      return Response.json({ error: "The history role is invalid." }, { status: 400 });
    }

    const passengerName = searchParams.get("name")?.trim();
    if (!passengerName) {
      return Response.json({ error: "A name is required to load trip history." }, { status: 400 });
    }

    try {
      return Response.json({ rides: await listCompletedRides(passengerName) });
    } catch (error) {
      return rideActionError(error, "load ride history");
    }
  }

  const requestedBy = searchParams.get("requestedBy")?.trim();
  const role = searchParams.get("role");

  if (!requestedBy) {
    return Response.json({ error: "A requester name is required." }, { status: 400 });
  }

  if (role !== null && !isRequesterRole(role)) {
    return Response.json({ error: "The requester role is invalid." }, { status: 400 });
  }

  const filter = role
    ? { "requestedBy.name": requestedBy, "requestedBy.role": role }
    : { "requestedBy.name": requestedBy };

  try {
    const database = await getDatabase();
    const rides = await database
      .collection<StoredRide>("rides")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      rides: rides.map((ride) => ({ ...ride, _id: ride._id.toString() })),
    });
  } catch (error) {
    return databaseErrorResponse(error, "fetch");
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isRecord(body) || !isRecord(body.requestedBy)) {
    return Response.json({ error: "Requester details are required." }, { status: 400 });
  }

  const requesterName = body.requestedBy.name;
  const requesterRole = body.requestedBy.role;

  if (typeof requesterName !== "string" || !requesterName.trim()) {
    return Response.json({ error: "A requester name is required." }, { status: 400 });
  }

  if (!isRequesterRole(requesterRole)) {
    return Response.json({ error: "Only students and employees can request rides." }, { status: 400 });
  }

  if (!isLocationName(body.from) || !isLocationName(body.to)) {
    return Response.json({ error: "Choose a valid pickup and destination location." }, { status: 400 });
  }

  if (body.from === body.to) {
    return Response.json({ error: "Pickup and destination must be different." }, { status: 400 });
  }

  if (!isValidScheduledAt(body.scheduledAt)) {
    return Response.json({ error: "Choose a valid date and time for the ride." }, { status: 400 });
  }

  if (!Array.isArray(body.passengers)) {
    return Response.json({ error: "Add at least one passenger." }, { status: 400 });
  }

  const passengerNames: string[] = [];
  for (const passenger of body.passengers) {
    if (!isRecord(passenger) || typeof passenger.name !== "string") {
      return Response.json({ error: "Each passenger must have a name." }, { status: 400 });
    }

    const name = passenger.name.trim();
    if (name) passengerNames.push(name);
  }

  if (passengerNames.length === 0) {
    return Response.json({ error: "Add at least one passenger with a name." }, { status: 400 });
  }

  const ride: StoredRide = {
    requestedBy: { name: requesterName.trim(), role: requesterRole },
    from: body.from,
    to: body.to,
    scheduledAt: body.scheduledAt,
    passengers: passengerNames.map((name) => ({ name, pickupStatus: "pending" })),
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  try {
    const database = await getDatabase();
    const result = await database.collection<StoredRide>("rides").insertOne(ride);

    return Response.json(
      { ride: { ...ride, _id: result.insertedId.toString() } },
      { status: 201 },
    );
  } catch (error) {
    return databaseErrorResponse(error, "create");
  }
}
