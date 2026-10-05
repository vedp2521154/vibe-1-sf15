import { getMobilitySettings, saveMobilitySettings } from "@/lib/configStore";

export async function GET() {
  try { return Response.json({ settings: await getMobilitySettings() }); }
  catch (error) {
    console.error("Mobility settings load failed:", error);
    return Response.json({ error: "Could not load vehicle settings. Check the MongoDB connection." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("vehicleName" in body) || typeof body.vehicleName !== "string" || !body.vehicleName.trim()) return Response.json({ error: "Enter a vehicle name." }, { status: 400 });
  if (body.vehicleName.trim().length > 40) return Response.json({ error: "Vehicle names must be 40 characters or fewer." }, { status: 400 });
  if (!("passengerCapacity" in body) || typeof body.passengerCapacity !== "number" || !Number.isInteger(body.passengerCapacity) || body.passengerCapacity < 1 || body.passengerCapacity > 20) return Response.json({ error: "Passenger capacity must be a whole number from 1 to 20." }, { status: 400 });
  try { return Response.json({ settings: await saveMobilitySettings(body.vehicleName, body.passengerCapacity) }); }
  catch (error) {
    console.error("Mobility settings save failed:", error);
    return Response.json({ error: "Could not save vehicle settings." }, { status: 503 });
  }
}
