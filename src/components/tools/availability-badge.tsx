import type { Availability } from "@convex/lib/availability";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/format";

export function AvailabilityBadge({
  availability,
  requestedByMe = false,
}: {
  availability: Availability;
  requestedByMe?: boolean;
}) {
  if (requestedByMe) return <Badge variant="outline">Requested</Badge>;
  if (availability.status === "on_loan") {
    return <Badge variant="secondary">On loan until {formatDay(availability.until)}</Badge>;
  }
  return (
    <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">Available</Badge>
  );
}
