import { clearSessionCookie, invalidateSession, isSameOriginRequest } from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  try { await invalidateSession(request); }
  catch (error) { console.error("Logout session invalidation failed:", error); }
  return Response.json({ success: true }, { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
}
