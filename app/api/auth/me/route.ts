import { AuthError, getCurrentUser, safeUser } from "@/lib/auth/server";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ user: safeUser(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    console.error("Session verification failed:", error);
    return Response.json({ error: "Could not verify your session." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
