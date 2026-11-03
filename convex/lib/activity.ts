import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type ActivityItem = { label: string; tone: "ok" | "warn" | "error"; at: number };

const FEED_LENGTH = 3;

/**
 * The latest automation activity for one loan, phrased for its borrower and
 * lender. Internal error details stay out; admins see them on the health panel.
 */
export async function loanActivity(ctx: QueryCtx, loanId: Id<"loans">): Promise<ActivityItem[]> {
  const events = await ctx.db
    .query("automationEvents")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .order("desc")
    .take(FEED_LENGTH);

  const items: ActivityItem[] = events.map((event) => ({
    label: labelFor(event),
    tone: event.kind.endsWith("_failed") ? "error" : "ok",
    at: event.createdAt,
  }));

  // Deliveries that failed at least once and are waiting for their next attempt.
  const outbox = await ctx.db
    .query("notificationOutbox")
    .withIndex("by_loan_status", (q) => q.eq("loanId", loanId).eq("status", "pending"))
    .collect();
  for (const event of outbox) {
    if (event.attempts > 0) {
      items.push({ label: "Notification failed – retrying", tone: "warn", at: event._creationTime });
    }
  }

  return items.sort((a, b) => b.at - a.at).slice(0, FEED_LENGTH);
}

function labelFor(event: Doc<"automationEvents">): string {
  switch (event.kind) {
    case "notification_sent":
      // e.g. "Lender notified: new request" -> "Lender notified"
      return event.message.split(":")[0];
    case "notification_failed":
      return "Notification failed";
    case "reminder_sent":
      return "Reminder sent";
    case "reminder_failed":
      return "Reminder failed – will retry";
    case "workflow_error":
      return "Automation error";
  }
}
