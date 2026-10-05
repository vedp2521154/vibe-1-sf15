import { requireApiUser } from "@/lib/auth/server";
import { listNotificationsForUser, markUserNotificationRead } from "@/lib/notificationStore";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  try {
    return Response.json(await listNotificationsForUser(auth.user.id), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return Response.json({ error: "Could not load notifications." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) return Response.json({ error: "Choose a notification to mark as read." }, { status: 400 });
  const payload = body as Record<string, unknown>;
  if (payload.markAllRead === true && Object.keys(payload).length === 1) {
    try { await markUserNotificationRead(auth.user.id); return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } }); }
    catch { return Response.json({ error: "Could not update notifications." }, { status: 503 }); }
  }
  if (typeof payload.id !== "string" || payload.read !== true || Object.keys(payload).some((key) => key !== "id" && key !== "read")) {
    return Response.json({ error: "Provide a notification id and set read to true." }, { status: 400 });
  }
  try {
    await markUserNotificationRead(auth.user.id, payload.id);
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Could not update this notification." }, { status: 503 }); }
}
