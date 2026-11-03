import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationType } from "./validators";

/**
 * Transactional outbox: the event row is written in the same mutation as the
 * status change, so it commits or rolls back with it. Delivery happens later,
 * outside the transaction, in a scheduled action (see notifications.deliver).
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
  // The scheduler is transactional too: if the mutation rolls back, nothing is sent.
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, { eventId });
  return eventId;
}
