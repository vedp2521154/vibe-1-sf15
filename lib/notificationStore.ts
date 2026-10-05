import { ObjectId, type Collection } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export type NotificationType =
  | "ride_accepted"
  | "ride_waitlisted"
  | "ride_cancelled"
  | "ride_available"
  | "ride_completed"
  | "new_ride_request";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  rideId?: string;
}

interface NotificationDocument {
  _id?: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  rideId: ObjectId | null;
  read: boolean;
  createdAt: Date;
}

let indexesReady: Promise<void> | null = null;

async function notificationsCollection(): Promise<Collection<NotificationDocument>> {
  const collection = (await getDatabase()).collection<NotificationDocument>("notifications");
  if (!indexesReady) {
    indexesReady = Promise.all([
      collection.createIndex({ userId: 1, createdAt: -1 }, { name: "notifications_user_created" }),
      collection.createIndex({ userId: 1, read: 1, createdAt: -1 }, { name: "notifications_user_read_created" }),
    ]).then(() => undefined).catch((error: unknown) => { indexesReady = null; throw error; });
  }
  await indexesReady;
  return collection;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  if (!ObjectId.isValid(input.userId)) return;
  await (await notificationsCollection()).insertOne({
    userId: new ObjectId(input.userId), type: input.type,
    title: input.title.slice(0, 100), message: input.message.slice(0, 300),
    rideId: input.rideId && ObjectId.isValid(input.rideId) ? new ObjectId(input.rideId) : null,
    read: false, createdAt: new Date(),
  });
}

export async function createNotificationsForUsers(userIds: string[], input: Omit<NotificationInput, "userId">): Promise<void> {
  const recipients = [...new Set(userIds)].filter(ObjectId.isValid).map((userId) => new ObjectId(userId));
  if (!recipients.length) return;
  const now = new Date();
  const rideId = input.rideId && ObjectId.isValid(input.rideId) ? new ObjectId(input.rideId) : null;
  await (await notificationsCollection()).insertMany(recipients.map((userId) => ({
    userId, type: input.type, title: input.title.slice(0, 100),
    message: input.message.slice(0, 300), rideId, read: false, createdAt: now,
  })));
}

export async function listNotificationsForUser(userId: string): Promise<{ notifications: Array<{
  id: string; type: NotificationType; title: string; message: string;
  rideId: string | null; read: boolean; createdAt: string;
}>; unreadCount: number }> {
  if (!ObjectId.isValid(userId)) return { notifications: [], unreadCount: 0 };
  const userObjectId = new ObjectId(userId);
  const collection = await notificationsCollection();
  const [records, unreadCount] = await Promise.all([
    collection.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(40).toArray(),
    collection.countDocuments({ userId: userObjectId, read: false }),
  ]);
  return {
    notifications: records.map((record) => ({
      id: record._id!.toString(), type: record.type, title: record.title,
      message: record.message, rideId: record.rideId?.toString() ?? null,
      read: record.read, createdAt: record.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function markUserNotificationRead(userId: string, notificationId?: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  const collection = await notificationsCollection();
  const filter = { userId: new ObjectId(userId), read: false } as const;
  if (notificationId) {
    if (!ObjectId.isValid(notificationId)) return;
    await collection.updateOne({ ...filter, _id: new ObjectId(notificationId) }, { $set: { read: true } });
  } else {
    await collection.updateMany(filter, { $set: { read: true } });
  }
}
