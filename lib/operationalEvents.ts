import { writeAuditEvent, type AuditEventInput } from "@/lib/activityStore";
import { createNotification, createNotificationsForUsers, type NotificationInput } from "@/lib/notificationStore";

export async function recordActivity(input: AuditEventInput): Promise<void> {
  await writeAuditEvent(input);
}

export async function sendUserNotification(input: NotificationInput): Promise<void> {
  try { await createNotification(input); }
  catch { console.error("Notification could not be created."); }
}

export async function sendUserNotifications(userIds: string[], input: Omit<NotificationInput, "userId">): Promise<void> {
  try { await createNotificationsForUsers(userIds, input); }
  catch { console.error("Notifications could not be created."); }
}
