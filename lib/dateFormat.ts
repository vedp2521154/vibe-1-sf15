export function formatDateTime(value: string): { date: string; time: string } {
  const dateTime = new Date(value);
  if (Number.isNaN(dateTime.getTime())) return { date: value, time: "" };

  return {
    date: new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(dateTime),
    time: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(dateTime),
  };
}
