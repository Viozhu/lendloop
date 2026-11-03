import { format, parseISO } from "date-fns";

/** "2026-11-03" -> "Nov 3, 2026" */
export function formatDay(isoDate: string): string {
  return format(parseISO(isoDate), "MMM d, yyyy");
}
