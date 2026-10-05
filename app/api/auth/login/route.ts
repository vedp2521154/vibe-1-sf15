import { authenticateUser, AuthError, createSession, isSameOriginRequest, safeUser, sessionCookie } from "@/lib/auth/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("username" in body) || typeof body.username !== "string" || !("password" in body) || typeof body.password !== "string") {
    return Response.json({ error: "Enter your username and password." }, { status: 400 });
  }
  try {
    const user = await authenticateUser(body.username, body.password);
    const session = await createSession(user.id);
    return Response.json({ user: safeUser(user) }, { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt), "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Login failed:", error);
    return Response.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
  }
}
