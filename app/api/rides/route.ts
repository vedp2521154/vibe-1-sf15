import { createScheduledRide, listCompletedRides, listRequesterRides, listRiderRides, RideStoreError, rideActionError, searchRideHistory } from "@/lib/ridesStore";
import { findRoleBySlug, getMobilitySettings, listLocations } from "@/lib/configStore";
import { requireApiUser } from "@/lib/auth/server";
import { isLocationName, type Ride } from "@/lib/types";
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
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

function databaseErrorResponse(error: unknown, action: "fetch" | "create"): Response {
  console.error(`Ride ${action} failed:`, error);
  return Response.json({ error: action === "create" ? "Your request could not be saved. Check the database connection and try again." : "Ride data could not be loaded. Check the database connection and try again." }, { status: 503 });
}

function historyDates(searchParams: URLSearchParams): { dateFrom?: string; dateBefore?: string } {
  const range = searchParams.get("range");
  if (range === "today" || range === "7" || range === "30") {
    const end = new Date(); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() + 1);
    return { dateBefore: end.toISOString().slice(0, 10), dateFrom: new Date(end.getTime() - (range === "today" ? 1 : Number(range) - 1) * 86400000).toISOString().slice(0, 10) };
  }
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo");
  let dateBefore: string | undefined;
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    const nextDate = new Date(`${dateTo}T00:00:00.000Z`); nextDate.setUTCDate(nextDate.getUTCDate() + 1); dateBefore = nextDate.toISOString().slice(0, 10);
  }
  return { ...(dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? { dateFrom } : {}), ...(dateBefore ? { dateBefore } : {}) };
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { user } = auth;
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  if (view === "rider") {
    if (user.category !== "rider" && user.category !== "admin") return Response.json({ error: "You do not have permission to view the operational ride queue." }, { status: 403 });
    try { return Response.json({ rides: await listRiderRides() }, { headers: { "Cache-Control": "no-store" } }); }
    catch (error) { return rideActionError(error, "load ride requests"); }
  }

  if (view === "history") {
    const archived = searchParams.get("archived") === "true";
    if (archived && user.category !== "admin") return Response.json({ error: "Only Admin can view archived trips." }, { status: 403 });
    if (user.category === "requester" && archived) return Response.json({ error: "Requesters cannot view archived trips." }, { status: 403 });
    const pageParam = searchParams.get("page");
    if (pageParam === null && user.category !== "requester") {
      try { return Response.json({ rides: await listCompletedRides() }, { headers: { "Cache-Control": "no-store" } }); }
      catch (error) { return rideActionError(error, "load ride history"); }
    }
    const page = pageParam === null ? 1 : Number(pageParam);
    const requestedSize = Number(searchParams.get("pageSize") ?? (user.category === "requester" ? "1000" : "10"));
    const pageSize = [10, 20, 50, 1000].includes(requestedSize) ? requestedSize : 10;
    if (!Number.isInteger(page) || page < 1) return Response.json({ error: "Page must be a positive integer." }, { status: 400 });
    const pickupStatus = searchParams.get("pickupStatus");
    if (pickupStatus && pickupStatus !== "boarded" && pickupStatus !== "missed") return Response.json({ error: "Passenger status filter is invalid." }, { status: 400 });
    const dates = historyDates(searchParams);
    try {
      const result = await searchRideHistory({
        archived,
        ...(user.category === "requester" ? { requesterUserId: user.id, requesterName: user.name, requesterRole: user.role } : {}),
        search: searchParams.get("search") ?? undefined,
        ...dates,
        pickupStatus: pickupStatus as "boarded" | "missed" | null ?? undefined,
        sort: searchParams.get("sort") === "oldest" ? "oldest" : "newest",
        page, pageSize,
      });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return rideActionError(error, "load ride history"); }
  }

  if (user.category !== "requester") return Response.json({ error: "Only requester accounts can load their personal ride requests." }, { status: 403 });
  try {
    return Response.json({ rides: await listRequesterRides(user.id, user.name, user.role) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseErrorResponse(error, "fetch"); }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, ["requester"]);
  if (auth.response) return auth.response;
  const { user } = auth;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return Response.json({ error: "Provide ride details." }, { status: 400 });
  if (!Array.isArray(body.passengers)) return Response.json({ error: "Add at least one passenger." }, { status: 400 });

  let roleConfig;
  let availableLocations;
  let mobilitySettings;
  try { [roleConfig, availableLocations, mobilitySettings] = await Promise.all([findRoleBySlug(user.role, false), listLocations(), getMobilitySettings()]); }
  catch (error) { return databaseErrorResponse(error, "create"); }
  if (!roleConfig || roleConfig.category !== "requester") return Response.json({ error: "Your requester role is currently unavailable." }, { status: 403 });
  if (body.passengers.length > mobilitySettings.passengerCapacity) return Response.json({ error: `A ${mobilitySettings.vehicleName} can carry a maximum of ${mobilitySettings.passengerCapacity} passengers.` }, { status: 400 });
  const allowedLocations = new Map(availableLocations.map((location) => [location.name.toLocaleLowerCase("en-US"), location.name]));
  if (!isLocationName(body.from) || !isLocationName(body.to)) return Response.json({ error: "Choose a valid pickup and destination location." }, { status: 400 });
  const from = allowedLocations.get(body.from.trim().toLocaleLowerCase("en-US"));
  const to = allowedLocations.get(body.to.trim().toLocaleLowerCase("en-US"));
  if (!from || !to) return Response.json({ error: "Choose active pickup and destination locations." }, { status: 400 });
  if (from === to) return Response.json({ error: "Pickup and destination must be different." }, { status: 400 });
  if (!isValidScheduledAt(body.scheduledAt)) return Response.json({ error: "Choose a valid date and time for the ride." }, { status: 400 });
  const estimatedDurationMinutes = body.estimatedDurationMinutes === undefined ? DEFAULT_RIDE_DURATION_MINUTES : body.estimatedDurationMinutes;
  if (!Number.isInteger(estimatedDurationMinutes) || (estimatedDurationMinutes as number) < 10 || (estimatedDurationMinutes as number) > 180) return Response.json({ error: "Trip duration must be a whole number from 10 to 180 minutes." }, { status: 400 });
  const passengerNames: string[] = [];
  for (const passenger of body.passengers) {
    if (!isRecord(passenger) || typeof passenger.name !== "string") return Response.json({ error: "Each passenger must have a name." }, { status: 400 });
    const name = passenger.name.trim(); if (name) passengerNames.push(name);
  }
  if (passengerNames.length === 0) return Response.json({ error: "Add at least one passenger with a name." }, { status: 400 });

  const ride: StoredRide = {
    requestedBy: { userId: user.id, name: user.name, role: user.role }, from, to,
    scheduledAt: body.scheduledAt, passengers: passengerNames.map((name) => ({ name, pickupStatus: "pending" })),
    status: "pending", createdAt: new Date().toISOString(), completedAt: null,
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
