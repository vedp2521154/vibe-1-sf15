import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });

    return Response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("MongoDB health check failed:", error);
    const missingConfiguration =
      error instanceof Error &&
      (error.message === "MONGODB_URI is not configured." ||
        error.message === "MONGODB_DB is not configured.");

    return Response.json(
      {
        status: "error",
        database: "disconnected",
        message: missingConfiguration
          ? "Set MONGODB_URI and MONGODB_DB in .env.local, then restart the server."
          : "Unable to connect to MongoDB. Check the Atlas URI and network access settings.",
      },
      { status: 503 },
    );
  }
}
