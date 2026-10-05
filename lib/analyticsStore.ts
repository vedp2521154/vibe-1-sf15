import { getDatabase } from "@/lib/mongodb";

export type AnalyticsRange = "today" | "7" | "30" | "all";

export interface RideAnalytics {
  range: AnalyticsRange;
  from: string | null;
  to: string | null;
  totalRides: number;
  completedRides: number;
  pendingRides: number;
  waitlistedRides: number;
  cancelledRides: number;
  acceptedRides: number;
  clashRides: number;
  boardedPassengers: number;
  missedPassengers: number;
  boardingRate: number | null;
  completionRate: number | null;
  eligibleRides: number;
  cancellationCount: number;
  mostUsedRoute: { from: string; to: string; count: number } | null;
  peakRequestTime: { from: string; to: string; count: number } | null;
  tripsByDay: Array<{ date: string; count: number }>;
}

function utcDateOffset(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

let indexesReady: Promise<void> | null = null;

async function ensureAnalyticsIndexes(): Promise<void> {
  const rides = (await getDatabase()).collection("rides");
  if (!indexesReady) {
    indexesReady = rides.createIndex({ scheduledAt: 1, status: 1 }, { name: "rides_scheduled_status" })
      .then(() => undefined)
      .catch((error: unknown) => { indexesReady = null; throw error; });
  }
  await indexesReady;
}

export async function getRideAnalytics(range: AnalyticsRange): Promise<RideAnalytics> {
  await ensureAnalyticsIndexes();
  const now = new Date();
  const to = new Date(now);
  to.setUTCHours(0, 0, 0, 0);
  to.setUTCDate(to.getUTCDate() + 1);
  const from = range === "all" ? null : utcDateOffset(range === "today" ? 0 : Number(range) - 1);
  const filter = from ? { scheduledAt: { $gte: `${from}T00:00:00`, $lt: `${to.toISOString().slice(0, 10)}T00:00:00` } } : {};

  const [result] = await (await getDatabase()).collection("rides").aggregate<{
    summary: Array<Record<string, number>>;
    routes: Array<{ _id: { from: string; to: string }; count: number }>;
    peak: Array<{ _id: string; count: number }>;
    days: Array<{ _id: string; count: number }>;
  }>([
    { $match: filter },
    { $facet: {
      summary: [{ $group: { _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        waitlisted: { $sum: { $cond: [{ $eq: ["$status", "waitlisted"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        clash: { $sum: { $cond: [{ $eq: ["$status", "clash"] }, 1, 0] } },
        boarded: { $sum: { $size: { $filter: { input: { $ifNull: ["$passengers", []] }, as: "passenger", cond: { $eq: ["$$passenger.pickupStatus", "boarded"] } } } } },
        missed: { $sum: { $size: { $filter: { input: { $ifNull: ["$passengers", []] }, as: "passenger", cond: { $eq: ["$$passenger.pickupStatus", "missed"] } } } } },
      } }],
      routes: [{ $group: { _id: { from: "$from", to: "$to" }, count: { $sum: 1 } } }, { $sort: { count: -1, "_id.from": 1, "_id.to": 1 } }, { $limit: 1 }],
      peak: [{ $match: { scheduledAt: { $type: "string" } } }, { $group: { _id: { $substrBytes: ["$scheduledAt", 11, 2] }, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 1 }],
      days: [{ $match: { scheduledAt: { $type: "string" } } }, { $group: { _id: { $substrBytes: ["$scheduledAt", 0, 10] }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 14 }, { $sort: { _id: 1 } }],
    } },
  ]).toArray();

  const summary = result?.summary[0] ?? {};
  const boarded = summary.boarded ?? 0;
  const missed = summary.missed ?? 0;
  const completed = summary.completed ?? 0;
  const accepted = summary.accepted ?? 0;
  const cancelled = summary.cancelled ?? 0;
  const eligible = completed + accepted + cancelled;
  const peakHour = result?.peak[0]?._id;
  const fromHour = peakHour && /^\d{2}$/.test(peakHour) ? Number(peakHour) : null;
  const toHour = fromHour === null ? null : (fromHour + 1) % 24;
  const hourLabel = (hour: number) => new Date(Date.UTC(2000, 0, 1, hour)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return {
    range, from, to: range === "all" ? null : to.toISOString().slice(0, 10),
    totalRides: summary.total ?? 0, completedRides: completed, pendingRides: summary.pending ?? 0,
    waitlistedRides: summary.waitlisted ?? 0, cancelledRides: cancelled, acceptedRides: accepted,
    clashRides: summary.clash ?? 0, boardedPassengers: boarded, missedPassengers: missed,
    boardingRate: boarded + missed ? Math.round(boarded / (boarded + missed) * 100) : null,
    completionRate: eligible ? Math.round(completed / eligible * 100) : null,
    eligibleRides: eligible, cancellationCount: cancelled,
    mostUsedRoute: result?.routes[0] ? { from: result.routes[0]._id.from, to: result.routes[0]._id.to, count: result.routes[0].count } : null,
    peakRequestTime: fromHour === null || toHour === null || !result?.peak[0] ? null : { from: hourLabel(fromHour), to: hourLabel(toHour), count: result.peak[0].count },
    tripsByDay: (result?.days ?? []).map(({ _id, count }) => ({ date: _id, count })),
  };
}
