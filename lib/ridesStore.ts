import { ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/mongodb";
import { calculateEstimatedEndAt, DEFAULT_RIDE_DURATION_MINUTES, ridesOverlap } from "@/lib/scheduling";
import type { PickupStatus, Ride, RoleCategory, UserRole } from "@/lib/types";
import { listActiveUserIdsByCategory } from "@/lib/auth/server";
import { recordActivity, sendUserNotification, sendUserNotifications } from "@/lib/operationalEvents";

type StoredRide = Omit<Ride, "_id">;

interface TotoState {
  _id: "toto";
  activeRideId?: string | null;
  lockToken?: string | null;
  lockUntil?: Date;
}

export class RideStoreError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "RideStoreError";
  }
}

export function parseRideObjectId(value: string): ObjectId | null {
  return /^[\da-f]{24}$/i.test(value) ? new ObjectId(value) : null;
}

async function ridesCollection(): Promise<Collection<StoredRide>> {
  return (await getDatabase()).collection<StoredRide>("rides");
}

function serializeRide(ride: WithId<StoredRide>): Ride {
  return { ...ride, _id: ride._id.toString() };
}

export async function listRiderRides(): Promise<Ride[]> {
  const rides = await ridesCollection();
  const results = await rides
    .find({ status: { $in: ["pending", "accepted", "waitlisted", "clash", "cancelled"] } })
    .sort({ scheduledAt: 1, createdAt: 1 })
    .toArray();

  return results.map(serializeRide);
}

export async function listRequesterRides(userId: string, displayName: string, roleSlug: string): Promise<Ride[]> {
  const rides = await ridesCollection();
  const legacyName = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const results = await rides.find({
    $and: [
      { $or: [
        { "requestedBy.userId": userId },
        { "requestedBy.userId": { $exists: false }, "requestedBy.name": { $regex: `^${legacyName}$`, $options: "i" }, "requestedBy.role": roleSlug },
      ] },
      { $or: [{ archived: false }, { archived: { $exists: false } }] },
    ],
  }).sort({ createdAt: -1 }).toArray();
  return results.map(serializeRide);
}

export async function listCompletedRides(passengerName?: string): Promise<Ride[]> {
  const rides = await ridesCollection();
  const filter: Filter<StoredRide> = {
    $and: [
      { status: "completed" },
      { $or: [{ archived: false }, { archived: { $exists: false } }] },
    ],
  };
  if (passengerName) {
    filter.$and!.push({ passengers: {
      $elemMatch: {
        name: {
          $regex: `^${passengerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
      },
    } });
  }
  const results = await rides.find(filter).sort({ completedAt: -1, createdAt: -1 }).toArray();

  return results.map(serializeRide);
}

export interface RideHistoryQuery {
  passengerName?: string;
  requesterUserId?: string;
  requesterName?: string;
  requesterRole?: string;
  archived: boolean;
  search?: string;
  dateFrom?: string;
  dateBefore?: string;
  pickupStatus?: "boarded" | "missed";
  sort?: "oldest" | "newest";
  page?: number;
  pageSize?: number;
}

export interface PaginatedRideHistory {
  rides: Ride[];
  total: number;
  page: number;
  pageSize: number;
}

export async function searchRideHistory(query: RideHistoryQuery): Promise<PaginatedRideHistory> {
  const rides = await ridesCollection();
  const clauses: Filter<StoredRide>[] = [
    { status: query.archived ? "completed" : { $in: ["completed", "cancelled"] } },
    query.archived
      ? { archived: true }
      : { $or: [{ archived: false }, { archived: { $exists: false } }] },
  ];

  if (query.passengerName) {
    const escaped = query.passengerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({ $or: [
      query.pickupStatus
        ? { $and: [
          { "requestedBy.name": { $regex: `^${escaped}$`, $options: "i" } },
          { passengers: { $elemMatch: { pickupStatus: query.pickupStatus } } },
        ] }
        : { "requestedBy.name": { $regex: `^${escaped}$`, $options: "i" } },
      { passengers: { $elemMatch: {
        name: { $regex: `^${escaped}$`, $options: "i" },
        ...(query.pickupStatus ? { pickupStatus: query.pickupStatus } : {}),
      } } },
    ] });
  }
  if (query.requesterUserId) {
    const escaped = (query.requesterName ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    clauses.push({ $or: [
      { "requestedBy.userId": query.requesterUserId },
      { $and: [
        { "requestedBy.userId": { $exists: false } },
        { "requestedBy.role": query.requesterRole },
        { $or: [
          { "requestedBy.name": { $regex: `^${escaped}$`, $options: "i" } },
          { passengers: { $elemMatch: { name: { $regex: `^${escaped}$`, $options: "i" } } } },
        ] },
      ] },
    ] });
  }
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: escaped, $options: "i" as const };
    clauses.push({ $or: [
      { "requestedBy.name": regex },
      { from: regex },
      { to: regex },
      { passengers: { $elemMatch: { name: regex } } },
    ] });
  }
  if (query.dateFrom || query.dateBefore) {
    const dateFilter: Record<string, string> = {};
    if (query.dateFrom) dateFilter.$gte = query.dateFrom;
    if (query.dateBefore) dateFilter.$lt = query.dateBefore;
    clauses.push({ scheduledAt: dateFilter });
  }
  if (query.pickupStatus && !query.passengerName) clauses.push({ passengers: { $elemMatch: { pickupStatus: query.pickupStatus } } });

  const filter: Filter<StoredRide> = { $and: clauses };
  const total = await rides.countDocuments(filter);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? Math.max(total, 1);
  const direction = query.sort === "oldest" ? 1 : -1;
  const found = await rides.aggregate<WithId<StoredRide>>([
    { $match: filter },
    { $addFields: { historyOrderAt: { $ifNull: ["$cancelledAt", { $ifNull: ["$completedAt", "$createdAt"] }] } } },
    { $sort: { historyOrderAt: direction, createdAt: direction } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
    { $project: { historyOrderAt: 0 } },
  ]).toArray();
  return {
    rides: found.map((ride) => ({ ...ride, archived: ride.archived ?? false, _id: ride._id.toString() })),
    total,
    page,
    pageSize,
  };
}

export async function setRideArchived(rideId: ObjectId, archived: boolean): Promise<Ride> {
  const rides = await ridesCollection();
  const ride = await rides.findOne({ _id: rideId });
  if (!ride) throw new RideStoreError("Ride record not found.", 404);
  if (ride.status !== "completed") throw new RideStoreError("Only completed trips can be archived.", 409);
  if ((ride.archived ?? false) === archived) throw new RideStoreError(archived ? "This trip is already archived." : "This trip is already active.", 409);
  const result = await rides.updateOne({ _id: rideId, status: "completed", archived: ride.archived ?? false }, { $set: { archived } });
  let matchedCount = result.matchedCount;
  // Legacy documents have no archived field, so update them with a completed-only conditional filter.
  if (matchedCount !== 1 && ride.archived === undefined) {
    const legacyResult = await rides.updateOne({ _id: rideId, status: "completed", archived: { $exists: false } }, { $set: { archived } });
    matchedCount = legacyResult.matchedCount;
  }
  if (matchedCount !== 1) throw new RideStoreError("This trip changed before its archive status could be updated.", 409);
  const updated = await rides.findOne({ _id: rideId });
  if (!updated) throw new RideStoreError("Ride record not found.", 404);
  return serializeRide(updated);
}

export async function permanentlyDeleteArchivedRide(rideId: ObjectId): Promise<Ride> {
  const rides = await ridesCollection();
  const ride = await rides.findOne({ _id: rideId });
  if (!ride) throw new RideStoreError("Ride record not found.", 404);
  if (ride.status !== "completed" || ride.archived !== true) {
    throw new RideStoreError("Only archived completed trips can be permanently deleted.", 409);
  }
  const result = await rides.deleteOne({ _id: rideId, status: "completed", archived: true });
  if (result.deletedCount !== 1) throw new RideStoreError("This trip changed before it could be deleted.", 409);
  return serializeRide(ride);
}

async function ensureTotoState(state: Collection<TotoState>): Promise<void> {
  try {
    await state.updateOne(
      { _id: "toto" },
      { $setOnInsert: { activeRideId: null, lockToken: null } },
      { upsert: true },
    );
  } catch (error) {
    // Two first-time requests can race to create the singleton document.
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) {
      throw error;
    }
  }
}

export async function withScheduleLock<T>(operation: () => Promise<T>): Promise<T> {
  const state = (await getDatabase()).collection<TotoState>("ride_control");
  await ensureTotoState(state);
  const token = randomUUID();
  const now = new Date();
  const lock = await state.updateOne(
    { _id: "toto", $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lte: now } }] },
    { $set: { lockToken: token, lockUntil: new Date(now.getTime() + 30_000) } },
  );
  if (lock.modifiedCount !== 1) throw new RideStoreError("Another scheduling update is in progress. Please retry shortly.", 409);
  try {
    return await operation();
  } finally {
    await state.updateOne({ _id: "toto", lockToken: token }, { $unset: { lockToken: "", lockUntil: "" } });
  }
}

async function moveOverlappingPendingToWaitlist(acceptedRide: Ride, actor: ActivityActor): Promise<void> {
  const rides = await ridesCollection();
  const pending = await rides.find({ status: "pending" }).toArray();
  const conflicts = pending.filter((ride) => ridesOverlap(acceptedRide, ride));
  if (!conflicts.length) return;
  const ids = conflicts.map((ride) => ride._id);
  const result = await rides.updateMany({ _id: { $in: ids }, status: "pending" }, { $set: { status: "waitlisted" } });
  if (!result.modifiedCount) return;
  for (const ride of conflicts) {
    const requester = ride.requestedBy.userId;
    const rideId = ride._id.toString();
    await Promise.all([
      recordActivity({ action: "ride_waitlisted", actor, entityType: "ride", entityId: rideId, details: { from: ride.from, to: ride.to } }),
      requester ? sendUserNotification({ userId: requester, type: "ride_waitlisted", title: "Ride added to waitlist", message: "Your ride overlaps a confirmed trip and is waiting for an available time.", rideId }) : Promise.resolve(),
    ]);
  }
}

export interface ActivityActor {
  userId: string;
  name: string;
  role: string;
}

export async function reevaluateWaitlist(actor: ActivityActor): Promise<Ride[]> {
  const rides = await ridesCollection();
  const [accepted, waitlisted] = await Promise.all([
    rides.find({ status: "accepted" }).toArray(),
    rides.find({ status: "waitlisted" }).sort({ createdAt: 1 }).toArray(),
  ]);
  const promoted: Ride[] = [];
  for (const waitingRide of waitlisted) {
    if (accepted.some((ride) => ridesOverlap(ride, waitingRide))) continue;
    const result = await rides.updateOne({ _id: waitingRide._id, status: "waitlisted" }, { $set: { status: "pending" } });
    if (result.modifiedCount === 1) {
      const updated = await rides.findOne({ _id: waitingRide._id });
      if (updated) {
        const ride = serializeRide(updated);
        promoted.push(ride);
        await Promise.all([
          recordActivity({ action: "ride_waitlist_promoted", actor, entityType: "ride", entityId: ride._id, details: { from: ride.from, to: ride.to } }),
          ride.requestedBy.userId ? sendUserNotification({ userId: ride.requestedBy.userId, type: "ride_available", title: "Ride request available", message: "Your waitlisted ride is now available for rider review.", rideId: ride._id }) : Promise.resolve(),
        ]);
      }
    }
  }
  return promoted;
}

export async function createScheduledRide(ride: StoredRide, actor: ActivityActor): Promise<Ride> {
  const created = await withScheduleLock(async () => {
    const database = await getDatabase();
    const rides = database.collection<StoredRide>("rides");
    const accepted = await rides.find({ status: "accepted" }).toArray();
    const rideWithStatus = {
      ...ride,
      status: accepted.some((existing) => ridesOverlap(existing, ride)) ? "waitlisted" as const : "pending" as const,
      estimatedDurationMinutes: ride.estimatedDurationMinutes ?? DEFAULT_RIDE_DURATION_MINUTES,
      estimatedEndAt: ride.estimatedEndAt ?? calculateEstimatedEndAt(ride.scheduledAt, ride.estimatedDurationMinutes ?? DEFAULT_RIDE_DURATION_MINUTES),
    };
    const result = await rides.insertOne(rideWithStatus);
    return { ...rideWithStatus, _id: result.insertedId.toString() };
  });
  await recordActivity({ action: "ride_created", actor, entityType: "ride", entityId: created._id, details: { from: created.from, to: created.to, passengerCount: created.passengers.length } });
  if (created.status === "waitlisted") {
    await Promise.all([
      recordActivity({ action: "ride_waitlisted", actor, entityType: "ride", entityId: created._id, details: { from: created.from, to: created.to } }),
      sendUserNotification({ userId: actor.userId, type: "ride_waitlisted", title: "Ride added to waitlist", message: "Your requested time overlaps a confirmed trip. We’ll let you know when it becomes available.", rideId: created._id }),
    ]);
  } else {
    const riderIds = await listActiveUserIdsByCategory("rider").catch(() => []);
    await sendUserNotifications(riderIds, { type: "new_ride_request", title: "New ride request", message: `A ride request is waiting: ${created.from} → ${created.to}.`, rideId: created._id });
  }
  return created;
}

export async function acceptRide(rideId: ObjectId, actor: ActivityActor): Promise<Ride> {
  return withScheduleLock(async () => {
    const rides = await ridesCollection();
    const ride = await rides.findOne({ _id: rideId });
    if (!ride) throw new RideStoreError("Ride request not found.", 404);
    if (ride.status !== "pending") throw new RideStoreError("This request is no longer pending.", 409);

    const acceptedRides = await rides.find({ status: "accepted" }).toArray();
    if (acceptedRides.some((existing) => ridesOverlap(existing, ride))) {
      await rides.updateOne({ _id: rideId, status: "pending" }, { $set: { status: "waitlisted" } });
      const updated = await rides.findOne({ _id: rideId });
      if (!updated) throw new RideStoreError("Ride request not found.", 404);
      const waitlisted = serializeRide(updated);
      await Promise.all([
        recordActivity({ action: "ride_waitlisted", actor, entityType: "ride", entityId: waitlisted._id, details: { from: waitlisted.from, to: waitlisted.to } }),
        waitlisted.requestedBy.userId ? sendUserNotification({ userId: waitlisted.requestedBy.userId, type: "ride_waitlisted", title: "Ride added to waitlist", message: "Your requested time overlaps a confirmed trip and is waiting for an available time.", rideId: waitlisted._id }) : Promise.resolve(),
      ]);
      return waitlisted;
    }

    const accepted = await rides.updateOne({ _id: rideId, status: "pending" }, { $set: { status: "accepted" } });
    if (accepted.modifiedCount !== 1) throw new RideStoreError("This request is no longer pending.", 409);
    const updatedRide = await rides.findOne({ _id: rideId });
    if (!updatedRide) throw new RideStoreError("Ride request not found.", 404);
    const result = serializeRide(updatedRide);
    await Promise.all([
      recordActivity({ action: "ride_accepted", actor, entityType: "ride", entityId: result._id, details: { from: result.from, to: result.to } }),
      result.requestedBy.userId ? sendUserNotification({ userId: result.requestedBy.userId, type: "ride_accepted", title: "Ride accepted", message: "Your ride request has been accepted.", rideId: result._id }) : Promise.resolve(),
    ]);
    await moveOverlappingPendingToWaitlist(result, actor);
    await reevaluateWaitlist(actor);
    return result;
  });
}

export async function updatePassengerPickupStatus(
  rideId: ObjectId,
  passengerIndex: number,
  pickupStatus: Exclude<PickupStatus, "pending">,
  actor: ActivityActor,
): Promise<Ride> {
  const rides = await ridesCollection();
  const ride = await rides.findOne({ _id: rideId });

  if (!ride) throw new RideStoreError("Ride request not found.", 404);
  if (ride.status !== "accepted") {
    throw new RideStoreError("Passenger status can only be changed for the active ride.", 409);
  }
  if (!Number.isInteger(passengerIndex) || passengerIndex < 0 || passengerIndex >= ride.passengers.length) {
    throw new RideStoreError("Passenger not found.", 404);
  }
  if (ride.passengers[passengerIndex].pickupStatus === pickupStatus) return serializeRide(ride);

  const result = await rides.updateOne(
    { _id: rideId, status: "accepted" },
    { $set: { [`passengers.${passengerIndex}.pickupStatus`]: pickupStatus } },
  );
  if (result.matchedCount !== 1) {
    throw new RideStoreError("The ride changed before the passenger status could be saved.", 409);
  }

  const updatedRide = await rides.findOne({ _id: rideId });
  if (!updatedRide) throw new RideStoreError("Ride request not found.", 404);
  const updated = serializeRide(updatedRide);
  await recordActivity({
    action: pickupStatus === "boarded" ? "passenger_boarded" : "passenger_missed",
    actor, entityType: "ride", entityId: updated._id,
    details: { from: updated.from, to: updated.to, pickupStatus },
  });
  return updated;
}

export async function completeRide(rideId: ObjectId, actor: ActivityActor): Promise<Ride> {
  return withScheduleLock(async () => {
    const rides = await ridesCollection();
    const ride = await rides.findOne({ _id: rideId });
    if (!ride) throw new RideStoreError("Ride request not found.", 404);
    if (ride.status !== "accepted") throw new RideStoreError("Only an accepted ride can be completed.", 409);
    if (
      ride.passengers.length === 0 ||
      ride.passengers.some((passenger) => passenger.pickupStatus !== "boarded" && passenger.pickupStatus !== "missed")
    ) throw new RideStoreError("Mark every passenger as Boarded or Missed before completing the trip.", 409);

    const completedAt = new Date().toISOString();
    const updateResult = await rides.updateOne(
      {
        _id: rideId,
        status: "accepted",
        passengers: { $not: { $elemMatch: { pickupStatus: { $nin: ["boarded", "missed"] } } } },
      },
      { $set: { status: "completed", completedAt } },
    );
    if (updateResult.modifiedCount !== 1) throw new RideStoreError("Mark every passenger as Boarded or Missed before completing the trip.", 409);
    const completedRide = await rides.findOne({ _id: rideId });
    if (!completedRide) throw new RideStoreError("Ride request not found.", 404);
    const completedResult = serializeRide(completedRide);
    await Promise.all([
      recordActivity({ action: "ride_completed", actor, entityType: "ride", entityId: completedResult._id, details: { from: completedResult.from, to: completedResult.to } }),
      completedResult.requestedBy.userId ? sendUserNotification({ userId: completedResult.requestedBy.userId, type: "ride_completed", title: "Trip completed", message: "Your ride has been completed.", rideId: completedResult._id }) : Promise.resolve(),
    ]);
    await reevaluateWaitlist(actor);
    return completedResult;
  });
}

export interface RideCancellationActor {
  userId: string;
  name: string;
  role: UserRole;
  category: RoleCategory;
}

export async function cancelRide(rideId: ObjectId, actor: RideCancellationActor, reason: string): Promise<Ride> {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new RideStoreError("A cancellation reason is required.", 400);
  if (cleanReason.length > 500) throw new RideStoreError("Cancellation reasons must be 500 characters or fewer.", 400);

  return withScheduleLock(async () => {
    const rides = await ridesCollection();
    const ride = await rides.findOne({ _id: rideId });
    if (!ride) throw new RideStoreError("Ride request not found.", 404);
    if (actor.category === "requester") {
      const ownsRide = Boolean(ride.requestedBy.userId) && ride.requestedBy.userId === actor.userId;
      if (!ownsRide) throw new RideStoreError("You can only cancel your own ride request.", 403);
      if (ride.status !== "pending" && ride.status !== "waitlisted") throw new RideStoreError("Requesters can cancel only pending or waitlisted rides.", 409);
    } else if (actor.category === "rider" || actor.category === "admin") {
      if (ride.status !== "pending" && ride.status !== "waitlisted" && ride.status !== "accepted") throw new RideStoreError("Only pending, waitlisted, or accepted rides can be cancelled.", 409);
    } else {
      throw new RideStoreError("This role cannot cancel rides.", 403);
    }

    const cancelledAt = new Date().toISOString();
    const result = await rides.updateOne(
      { _id: rideId, status: ride.status },
      { $set: {
        status: "cancelled",
        cancelledAt,
        cancelledBy: { userId: actor.userId, name: actor.name.trim(), role: actor.role },
        cancellationReason: cleanReason,
      } },
    );
    if (result.modifiedCount !== 1) throw new RideStoreError("This ride changed before it could be cancelled.", 409);
    if (ride.status === "accepted") await reevaluateWaitlist(actor);
    const cancelled = await rides.findOne({ _id: rideId });
    if (!cancelled) throw new RideStoreError("Ride request not found.", 404);
    const resultRide = serializeRide(cancelled);
    await Promise.all([
      recordActivity({ action: "ride_cancelled", actor, entityType: "ride", entityId: resultRide._id, details: { from: resultRide.from, to: resultRide.to, status: resultRide.status } }),
      actor.category !== "requester" && resultRide.requestedBy.userId ? sendUserNotification({ userId: resultRide.requestedBy.userId, type: "ride_cancelled", title: "Ride cancelled", message: `${actor.name} cancelled your ride request.`, rideId: resultRide._id }) : Promise.resolve(),
    ]);
    return resultRide;
  });
}

export function rideActionError(error: unknown, action: string): Response {
  if (error instanceof RideStoreError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(`Ride ${action} failed:`, error);
  return Response.json(
    { error: `Could not ${action}. Please check the MongoDB connection and try again.` },
    { status: 503 },
  );
}
