export function formatInClinicTz(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
