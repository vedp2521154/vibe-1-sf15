import { ObjectId, type Collection } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export type AuditAction =
  | "ride_created"
  | "ride_accepted"
  | "ride_waitlisted"
  | "ride_waitlist_promoted"
  | "passenger_boarded"
  | "passenger_missed"
  | "ride_completed"
  | "ride_cancelled"
  | "ride_archived"
  | "ride_restored"
  | "ride_deleted"
  | "location_added"
  | "location_disabled"
  | "location_enabled"
  | "role_added"
  | "role_disabled"
  | "role_enabled"
  | "settings_changed"
  | "user_created"
  | "user_disabled"
  | "user_enabled"
  | "user_role_changed"
  | "user_password_reset";

export interface ActivityActor {
  userId?: string;
  name: string;
  role: string;
}

export interface AuditEventInput {
  action: AuditAction;
  actor: ActivityActor;
  entityType: "ride" | "user" | "role" | "location" | "settings";
  entityId?: string;
  details?: Record<string, string | number | boolean>;
}

interface AuditDocument {
  action: AuditAction;
  actorUserId: ObjectId | null;
  actorName: string;
  actorRole: string;
  entityType: AuditEventInput["entityType"];
  entityId: ObjectId | null;
  details: Record<string, string | number | boolean>;
  createdAt: Date;
}

let indexesReady: Promise<void> | null = null;

async function auditCollection(): Promise<Collection<AuditDocument>> {
  const collection = (await getDatabase()).collection<AuditDocument>("auditLogs");
  if (!indexesReady) {
    indexesReady = collection.createIndex({ createdAt: -1 }, { name: "audit_created_at" })
      .then(() => undefined)
      .catch((error: unknown) => { indexesReady = null; throw error; });
  }
  await indexesReady;
  return collection;
}

const SAFE_DETAIL_KEYS = new Set([
  "from", "to", "route", "role", "roleName", "username", "displayName",
  "vehicleName", "previousVehicleName", "passengerCapacity", "previousPassengerCapacity",
  "passengerCount", "pickupStatus", "status",
]);

function safeDetails(details: AuditEventInput["details"]): Record<string, string | number | boolean> {
  if (!details) return {};
  return Object.fromEntries(Object.entries(details)
    .filter(([key, value]) => SAFE_DETAIL_KEYS.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]));
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const collection = await auditCollection();
    await collection.insertOne({
      action: input.action,
      actorUserId: input.actor.userId && ObjectId.isValid(input.actor.userId) ? new ObjectId(input.actor.userId) : null,
      actorName: input.actor.name.trim().slice(0, 80),
      actorRole: input.actor.role.slice(0, 50),
      entityType: input.entityType,
      entityId: input.entityId && ObjectId.isValid(input.entityId) ? new ObjectId(input.entityId) : null,
      details: safeDetails(input.details),
      createdAt: new Date(),
    });
  } catch {
    // Activity recording must never block a ride or account operation, and event data is not written to logs.
    console.error("Audit event could not be recorded.");
  }
}

export interface RecentActivityEvent {
  id: string;
  action: AuditAction;
  actorName: string;
  actorRole: string;
  entityType: AuditEventInput["entityType"];
  entityId: string | null;
  details: Record<string, string | number | boolean>;
  createdAt: string;
}

export async function listRecentActivity(limit = 20): Promise<RecentActivityEvent[]> {
  const records = await (await auditCollection()).find({}).sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 50)).toArray();
  return records.map((record) => ({
    id: record._id!.toString(), action: record.action, actorName: record.actorName,
    actorRole: record.actorRole, entityType: record.entityType,
    entityId: record.entityId?.toString() ?? null, details: record.details,
    createdAt: record.createdAt.toISOString(),
  }));
}
