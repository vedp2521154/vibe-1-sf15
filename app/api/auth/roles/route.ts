import { listRoles } from "@/lib/configStore";

export async function GET() {
  try {
    const roles = (await listRoles(false)).filter((role) => role.category === "requester").map(({ slug, name }) => ({ slug, name }));
    return Response.json({ roles }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Registration role lookup failed:", error);
    return Response.json({ error: "Could not load available requester roles." }, { status: 503 });
  }
}
