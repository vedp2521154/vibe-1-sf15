import { getMobilitySettings, saveMobilitySettings } from "@/lib/configStore";
import { requireApiUser } from "@/lib/auth/server";
import { recordActivity } from "@/lib/operationalEvents";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  try { return Response.json({ settings: await getMobilitySettings() }); }
  catch (error) {
    console.error("Mobility settings load failed:", error);
    return Response.json({ error: "Could not load vehicle settings. Check the MongoDB connection." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(request, ["admin"]);
  if (auth.response) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("vehicleName" in body) || typeof body.vehicleName !== "string" || !body.vehicleName.trim()) return Response.json({ error: "Enter a vehicle name." }, { status: 400 });
  if (body.vehicleName.trim().length > 40) return Response.json({ error: "Vehicle names must be 40 characters or fewer." }, { status: 400 });
  if (!("passengerCapacity" in body) || typeof body.passengerCapacity !== "number" || !Number.isInteger(body.passengerCapacity) || body.passengerCapacity < 1 || body.passengerCapacity > 20) return Response.json({ error: "Passenger capacity must be a whole number from 1 to 20." }, { status: 400 });
  try {
    const previous = await getMobilitySettings();
    const settings = await saveMobilitySettings(body.vehicleName, body.passengerCapacity);
    await recordActivity({
      action: "settings_changed", actor: { userId: auth.user.id, name: auth.user.name, role: auth.user.role }, entityType: "settings",
      details: { vehicleName: settings.vehicleName, previousVehicleName: previous.vehicleName, passengerCapacity: settings.passengerCapacity, previousPassengerCapacity: previous.passengerCapacity },
    });
    return Response.json({ settings });
  }
  catch (error) {
    console.error("Mobility settings save failed:", error);
    return Response.json({ error: "Could not save vehicle settings." }, { status: 503 });
  }
}
