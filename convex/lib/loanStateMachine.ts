import { appError } from "./errors";
import type { LoanStatus, NotificationType } from "./validators";

// The only legal moves. Terminal states (declined, cancelled, returned) have none.
const VALID_TRANSITIONS: Record<LoanStatus, readonly LoanStatus[]> = {
  pending: ["approved", "declined", "cancelled"],
  approved: ["returned"],
  declined: [],
  cancelled: [],
  returned: [],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: LoanStatus, to: LoanStatus): void {
  if (!canTransition(from, to)) {
    throw appError("INVALID_TRANSITION", `Cannot move a ${from} loan to ${to}`);
  }
}

type ReachableStatus = Exclude<LoanStatus, "pending">;

/** Which notification each new status emits, and who receives it. */
export const NOTIFICATION_FOR: Record<
  ReachableStatus,
  { type: NotificationType; recipient: "lender" | "borrower" }
> = {
  approved: { type: "loan.approved", recipient: "borrower" },
  declined: { type: "loan.declined", recipient: "borrower" },
  cancelled: { type: "loan.cancelled", recipient: "lender" },
  returned: { type: "loan.returned", recipient: "borrower" },
};
