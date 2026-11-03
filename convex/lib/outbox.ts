import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationType } from "./validators";

/**
 * Transactional outbox: the event row is written in the same mutation as the
 * status change, so it commits or rolls back with it. Delivery happens later,
 * outside the transaction.
 */
export async function enqueueNotification(
  ctx: MutationCtx,
  event: { loanId: Id<"loans">; type: NotificationType; recipientUserId: Id<"users"> },
): Promise<string> {
  const eventId = crypto.randomUUID();
  await ctx.db.insert("notificationOutbox", {
    ...event,
    eventId,
    status: "pending",
    attempts: 0,
  });
  return eventId;
}
