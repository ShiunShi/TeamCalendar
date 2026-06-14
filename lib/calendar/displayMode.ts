export type CalendarDisplayMode = "month" | "quarter";

export function parseCalendarDisplayMode(
  value: string | null | undefined,
): CalendarDisplayMode {
  return value === "quarter" ? "quarter" : "month";
}
