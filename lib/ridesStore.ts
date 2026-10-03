import { ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import type { PickupStatus, Ride } from "@/lib/types";

type StoredRide = Omit<Ride, "_id">;

interface TotoState {
  _id: "toto";
  activeRideId: string | null;
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
    .find({ status: { $in: ["pending", "accepted", "clash"] } })
    .sort({ scheduledAt: 1, createdAt: 1 })
    .toArray();

  return results.map(serializeRide);
}

export async function listCompletedRides(passengerName?: string): Promise<Ride[]> {
  const rides = await ridesCollection();
  const filter: Filter<StoredRide> = { status: "completed" };
  if (passengerName) {
    filter.passengers = {
      $elemMatch: {
        name: {
          $regex: `^${passengerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
      },
    };
  }
  const results = await rides.find(filter).sort({ completedAt: -1, createdAt: -1 }).toArray();

  return results.map(serializeRide);
}

async function ensureTotoState(state: Collection<TotoState>): Promise<void> {
  try {
    await state.updateOne(
      { _id: "toto" },
      { $setOnInsert: { activeRideId: null } },
      { upsert: true },
    );
  } catch (error) {
    // Two first-time requests can race to create the singleton document.
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) {
      throw error;
    }
  }
}

async function releaseToto(state: Collection<TotoState>, rideId: ObjectId): Promise<void> {
  await state.updateOne(
    { _id: "toto", activeRideId: rideId.toString() },
    { $set: { activeRideId: null } },
  );
}

export async function acceptRide(rideId: ObjectId): Promise<Ride> {
  const database = await getDatabase();
  const rides = database.collection<StoredRide>("rides");
  const state = database.collection<TotoState>("ride_control");
  const ride = await rides.findOne({ _id: rideId });

  if (!ride) throw new RideStoreError("Ride request not found.", 404);
  if (ride.status !== "pending") {
    throw new RideStoreError("This request is no longer pending.", 409);
  }

  const acceptedAtSameTime = await rides.findOne({
    status: "accepted",
    scheduledAt: ride.scheduledAt,
  });
  if (acceptedAtSameTime) {
    throw new RideStoreError("Another ride is already accepted for this time.", 409);
  }

  const activeRide = await rides.findOne({ status: "accepted" });
  if (activeRide) {
    throw new RideStoreError("The Toto is currently assigned to another ride.", 409);
  }

  await ensureTotoState(state);
  const reservation = await state.findOneAndUpdate(
    { _id: "toto", activeRideId: null },
    { $set: { activeRideId: rideId.toString() } },
    { returnDocument: "after" },
  );

  if (!reservation) {
    const currentActiveRide = await rides.findOne({ status: "accepted" });
    if (currentActiveRide?.scheduledAt === ride.scheduledAt) {
      throw new RideStoreError("Another ride is already accepted for this time.", 409);
    }
    throw new RideStoreError("The Toto is currently assigned to another ride.", 409);
  }

  try {
    const latestRide = await rides.findOne({ _id: rideId });
    if (!latestRide) throw new RideStoreError("Ride request not found.", 404);
    if (latestRide.status !== "pending") {
      throw new RideStoreError("This request is no longer pending.", 409);
    }

    const accepted = await rides.updateOne(
      { _id: rideId, status: "pending" },
      { $set: { status: "accepted" } },
    );
    if (accepted.modifiedCount !== 1) {
      throw new RideStoreError("This request is no longer pending.", 409);
    }

    await rides.updateMany(
      { _id: { $ne: rideId }, scheduledAt: ride.scheduledAt, status: "pending" },
      { $set: { status: "clash" } },
    );

    const updatedRide = await rides.findOne({ _id: rideId });
    if (!updatedRide) throw new RideStoreError("Ride request not found.", 404);
    return serializeRide(updatedRide);
  } catch (error) {
    const currentRide = await rides.findOne({ _id: rideId });
    if (currentRide?.status !== "accepted") {
      await releaseToto(state, rideId);
    }
    throw error;
  }
}

export async function updatePassengerPickupStatus(
  rideId: ObjectId,
  passengerIndex: number,
  pickupStatus: Exclude<PickupStatus, "pending">,
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

  const result = await rides.updateOne(
    { _id: rideId, status: "accepted" },
    { $set: { [`passengers.${passengerIndex}.pickupStatus`]: pickupStatus } },
  );
  if (result.matchedCount !== 1) {
    throw new RideStoreError("The ride changed before the passenger status could be saved.", 409);
  }

  const updatedRide = await rides.findOne({ _id: rideId });
  if (!updatedRide) throw new RideStoreError("Ride request not found.", 404);
  return serializeRide(updatedRide);
}

export async function completeRide(rideId: ObjectId): Promise<Ride> {
  const database = await getDatabase();
  const rides = database.collection<StoredRide>("rides");
  const state = database.collection<TotoState>("ride_control");
  const ride = await rides.findOne({ _id: rideId });

  if (!ride) throw new RideStoreError("Ride request not found.", 404);
  if (ride.status !== "accepted") {
    throw new RideStoreError("Only the active ride can be completed.", 409);
  }
  if (
    ride.passengers.length === 0 ||
    ride.passengers.some((passenger) => passenger.pickupStatus !== "boarded" && passenger.pickupStatus !== "missed")
  ) {
    throw new RideStoreError("Mark every passenger as Boarded or Missed before completing the trip.", 409);
  }

  const completedAt = new Date().toISOString();
  const result = await rides.updateOne(
    {
      _id: rideId,
      status: "accepted",
      passengers: { $not: { $elemMatch: { pickupStatus: { $nin: ["boarded", "missed"] } } } },
    },
    { $set: { status: "completed", completedAt } },
  );
  if (result.modifiedCount !== 1) {
    throw new RideStoreError("Mark every passenger as Boarded or Missed before completing the trip.", 409);
  }

  await releaseToto(state, rideId);

  const completedRide = await rides.findOne({ _id: rideId });
  if (!completedRide) throw new RideStoreError("Ride request not found.", 404);
  return serializeRide(completedRide);
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
