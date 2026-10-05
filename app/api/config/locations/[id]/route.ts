import { setLocationActive } from "@/lib/configStore";
import { requireApiUser } from "@/lib/auth/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("active" in body) || typeof body.active !== "boolean") return Response.json({ error: "Provide an active value." }, { status: 400 });
  try {
    const { id } = await context.params;
    const location = await setLocationActive(id, body.active);
    if (!location) return Response.json({ error: "Location not found." }, { status: 404 });
    return Response.json({ location });
  } catch (error) {
    console.error("Location update failed:", error);
    return Response.json({ error: "Could not update the location." }, { status: 503 });
  }
}
