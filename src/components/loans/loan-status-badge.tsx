import type { LoanStatus } from "@convex/lib/validators";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<LoanStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  returned: "Returned",
};

export function LoanStatusBadge({ status, isOverdue }: { status: LoanStatus; isOverdue: boolean }) {
  if (isOverdue) return <Badge variant="destructive">Overdue</Badge>;
  const variant = status === "approved" ? "default" : status === "pending" ? "outline" : "secondary";
  return <Badge variant={variant}>{LABELS[status]}</Badge>;
}
