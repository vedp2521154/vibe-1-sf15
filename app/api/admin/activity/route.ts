import { listRecentActivity } from "@/lib/activityStore";
import { requireApiUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  try {
    return Response.json({ events: await listRecentActivity(20) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return Response.json({ error: "Could not load recent activity." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
