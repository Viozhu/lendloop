import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assertTransition, NOTIFICATION_FOR } from "./loanStateMachine";
import { enqueueNotification } from "./outbox";
import type { LoanStatus } from "./validators";

/** Applies a validated status change and enqueues its notification in the same transaction. */
export async function applyTransition(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  to: Exclude<LoanStatus, "pending">,
): Promise<void> {
  assertTransition(loan.status, to);
  const now = Date.now();
  await ctx.db.patch(loan._id, {
    status: to,
    ...(to === "returned" ? { returnedAt: now } : { decidedAt: now }),
  });

  const { type, recipient } = NOTIFICATION_FOR[to];
  await enqueueNotification(ctx, {
    loanId: loan._id,
    type,
    recipientUserId: recipient === "lender" ? loan.lenderId : loan.borrowerId,
  });
}
