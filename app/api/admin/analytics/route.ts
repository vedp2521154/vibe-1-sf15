import { getRideAnalytics, type AnalyticsRange } from "@/lib/analyticsStore";
import { requireApiUser } from "@/lib/auth/server";

const ranges: AnalyticsRange[] = ["today", "7", "30", "all"];

export async function GET(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const requested = new URL(request.url).searchParams.get("range") ?? "7";
  if (!ranges.includes(requested as AnalyticsRange)) return Response.json({ error: "Choose today, 7, 30, or all." }, { status: 400 });
  try {
    const analytics = await getRideAnalytics(requested as AnalyticsRange);
    return Response.json({ analytics }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return Response.json({ error: "Could not load ride analytics." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
