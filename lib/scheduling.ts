import type { Ride } from "@/lib/types";

export const DEFAULT_RIDE_DURATION_MINUTES = 30;

function scheduleTime(value: string): number {
  const localTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) ? `${value}Z` : value;
  return Date.parse(localTimestamp);
}

export function calculateEstimatedEndAt(scheduledAt: string, durationMinutes: number): string {
  const start = scheduleTime(scheduledAt);
  if (!Number.isFinite(start)) throw new Error("The scheduled time is invalid.");
  return new Date(start + durationMinutes * 60_000).toISOString().slice(0, 19);
}

export function getRideDurationMinutes(ride: Pick<Ride, "estimatedDurationMinutes">): number {
  const value = ride.estimatedDurationMinutes;
  return Number.isInteger(value) && value! >= 10 && value! <= 180 ? value! : DEFAULT_RIDE_DURATION_MINUTES;
}

export function getRideStartTime(ride: Pick<Ride, "scheduledAt">): number {
  return scheduleTime(ride.scheduledAt);
}

export function getRideEndTime(ride: Pick<Ride, "scheduledAt" | "estimatedDurationMinutes" | "estimatedEndAt">): number {
  const storedEnd = ride.estimatedEndAt ? scheduleTime(ride.estimatedEndAt) : Number.NaN;
  if (Number.isFinite(storedEnd) && storedEnd > getRideStartTime(ride)) return storedEnd;
  return scheduleTime(calculateEstimatedEndAt(ride.scheduledAt, getRideDurationMinutes(ride)));
}

export function getRideEstimatedEndAt(ride: Pick<Ride, "scheduledAt" | "estimatedDurationMinutes" | "estimatedEndAt">): string {
  return Number.isFinite(ride.estimatedEndAt ? scheduleTime(ride.estimatedEndAt) : Number.NaN) && getRideEndTime(ride) === scheduleTime(ride.estimatedEndAt!)
    ? ride.estimatedEndAt!
    : calculateEstimatedEndAt(ride.scheduledAt, getRideDurationMinutes(ride));
}

export function ridesOverlap(
  first: Pick<Ride, "scheduledAt" | "estimatedDurationMinutes" | "estimatedEndAt">,
  second: Pick<Ride, "scheduledAt" | "estimatedDurationMinutes" | "estimatedEndAt">,
): boolean {
  const firstStart = getRideStartTime(first);
  const secondStart = getRideStartTime(second);
  const firstEnd = getRideEndTime(first);
  const secondEnd = getRideEndTime(second);
  return Number.isFinite(firstStart) && Number.isFinite(secondStart) && firstStart < secondEnd && firstEnd > secondStart;
}
