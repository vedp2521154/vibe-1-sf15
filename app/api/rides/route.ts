import { getDatabase } from "@/lib/mongodb";
import { createScheduledRide, listCompletedRides, listRiderRides, RideStoreError, rideActionError, searchRideHistory } from "@/lib/ridesStore";
import { findRoleBySlug, getMobilitySettings, listLocations } from "@/lib/configStore";
import { requestUsesAdminRole } from "@/lib/adminAuthorization";
import { isLocationName, isUserRole, type Ride } from "@/lib/types";
import { calculateEstimatedEndAt, DEFAULT_RIDE_DURATION_MINUTES } from "@/lib/scheduling";

type StoredRide = Omit<Ride, "_id">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    if (historyRole && isUserRole(historyRole)) {
      try {
        const roleConfig = await findRoleBySlug(historyRole, true);
        if (!roleConfig) return Response.json({ error: "The history role is invalid." }, { status: 400 });
        const archived = searchParams.get("archived") === "true";
        if (archived && (roleConfig.category !== "admin" || !(await requestUsesAdminRole(request)))) {
          return Response.json({ error: "Only Admin can view archived trips." }, { status: 403 });
        }
        const pageParam = searchParams.get("page");
        if (pageParam !== null) {
          const page = Number(pageParam);
          const requestedSize = Number(searchParams.get("pageSize") ?? "10");
          const pageSize = [10, 20, 50].includes(requestedSize) ? requestedSize : 10;
          if (!Number.isInteger(page) || page < 1) return Response.json({ error: "Page must be a positive integer." }, { status: 400 });

          let dateFrom: string | undefined;
          let dateBefore: string | undefined;
          const range = searchParams.get("range");
          if (range === "today" || range === "7" || range === "30") {
            const end = new Date();
            end.setUTCHours(0, 0, 0, 0);
            end.setUTCDate(end.getUTCDate() + 1);
            dateBefore = end.toISOString().slice(0, 10);
            if (range === "today") dateFrom = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
            else dateFrom = new Date(end.getTime() - (Number(range) - 1) * 86400000).toISOString().slice(0, 10);
          } else {
            const fromValue = searchParams.get("dateFrom");
            const toValue = searchParams.get("dateTo");
            if (fromValue && /^\d{4}-\d{2}-\d{2}$/.test(fromValue)) dateFrom = fromValue;
            if (toValue && /^\d{4}-\d{2}-\d{2}$/.test(toValue)) {
              const nextDate = new Date(`${toValue}T00:00:00.000Z`);
              nextDate.setUTCDate(nextDate.getUTCDate() + 1);
              dateBefore = nextDate.toISOString().slice(0, 10);
            }
          }
          const pickupStatus = searchParams.get("pickupStatus");
          if (pickupStatus && pickupStatus !== "boarded" && pickupStatus !== "missed") return Response.json({ error: "Passenger status filter is invalid." }, { status: 400 });
          if (roleConfig.category === "requester" && !searchParams.get("name")?.trim()) return Response.json({ error: "A name is required to load trip history." }, { status: 400 });
          const result = await searchRideHistory({
            archived,
            passengerName: roleConfig.category === "requester" ? searchParams.get("name")?.trim() || undefined : undefined,
            search: searchParams.get("search") ?? undefined,
            dateFrom,
            dateBefore,
            pickupStatus: pickupStatus ? pickupStatus as "boarded" | "missed" : undefined,
            sort: searchParams.get("sort") === "oldest" ? "oldest" : "newest",
            page,
            pageSize,
          });
          return Response.json(result);
        }
        if (roleConfig.category !== "requester") return Response.json({ rides: await listCompletedRides() });
        const passengerName = searchParams.get("name")?.trim();
        if (!passengerName) return Response.json({ error: "A name is required to load trip history." }, { status: 400 });
        return Response.json({ rides: await listCompletedRides(passengerName) });
      } catch (error) {
        return rideActionError(error, "load ride history");
      }
    }
    return Response.json({ error: "The history role is invalid." }, { status: 400 });
  }

  const requestedBy = searchParams.get("requestedBy")?.trim();
  const role = searchParams.get("role");

  if (!requestedBy) {
    return Response.json({ error: "A requester name is required." }, { status: 400 });
  }

  try {
    if (role !== null) {
      if (!isUserRole(role)) return Response.json({ error: "The requester role is invalid." }, { status: 400 });
      const config = await findRoleBySlug(role, true);
      if (!config || config.category !== "requester") return Response.json({ error: "The requester role is invalid." }, { status: 400 });
    }
    const filter = {
      $and: [
        role
          ? { "requestedBy.name": requestedBy, "requestedBy.role": role }
          : { "requestedBy.name": requestedBy },
        { $or: [{ archived: false }, { archived: { $exists: false } }] },
      ],
    };
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

  if (typeof requesterRole !== "string" || !isUserRole(requesterRole)) {
    return Response.json({ error: "Choose a valid requester role." }, { status: 400 });
  }

  if (!Array.isArray(body.passengers)) {
    return Response.json({ error: "Add at least one passenger." }, { status: 400 });
  }

  let roleConfig;
  let availableLocations;
  let mobilitySettings;
  try {
    [roleConfig, availableLocations, mobilitySettings] = await Promise.all([
      findRoleBySlug(requesterRole, false), listLocations(), getMobilitySettings(),
    ]);
  } catch (error) { return databaseErrorResponse(error, "create"); }
  if (!roleConfig || roleConfig.category !== "requester") return Response.json({ error: "This requester role is unavailable." }, { status: 400 });
  if (body.passengers.length > mobilitySettings.passengerCapacity) return Response.json({ error: `A ${mobilitySettings.vehicleName} can carry a maximum of ${mobilitySettings.passengerCapacity} passengers.` }, { status: 400 });
  const allowedLocations = new Map(availableLocations.map((location) => [location.name.toLocaleLowerCase("en-US"), location.name]));
  if (!isLocationName(body.from) || !isLocationName(body.to)) return Response.json({ error: "Choose a valid pickup and destination location." }, { status: 400 });
  const from = allowedLocations.get(body.from.trim().toLocaleLowerCase("en-US"));
  const to = allowedLocations.get(body.to.trim().toLocaleLowerCase("en-US"));
  if (!from || !to) return Response.json({ error: "Choose active pickup and destination locations." }, { status: 400 });
  if (from === to) return Response.json({ error: "Pickup and destination must be different." }, { status: 400 });
  if (!isValidScheduledAt(body.scheduledAt)) return Response.json({ error: "Choose a valid date and time for the ride." }, { status: 400 });
  const estimatedDurationMinutes = body.estimatedDurationMinutes === undefined
    ? DEFAULT_RIDE_DURATION_MINUTES
    : body.estimatedDurationMinutes;
  if (!Number.isInteger(estimatedDurationMinutes) || (estimatedDurationMinutes as number) < 10 || (estimatedDurationMinutes as number) > 180) {
    return Response.json({ error: "Trip duration must be a whole number from 10 to 180 minutes." }, { status: 400 });
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
    from,
    to,
    scheduledAt: body.scheduledAt,
    passengers: passengerNames.map((name) => ({ name, pickupStatus: "pending" })),
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
    estimatedDurationMinutes: estimatedDurationMinutes as number,
    estimatedEndAt: calculateEstimatedEndAt(body.scheduledAt, estimatedDurationMinutes as number),
  };

  try {
    const created = await createScheduledRide(ride);
    return Response.json({ ride: created }, { status: 201 });
  } catch (error) {
    if (error instanceof RideStoreError) return rideActionError(error, "create");
    return databaseErrorResponse(error, "create");
  }
}
