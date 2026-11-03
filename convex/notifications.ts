import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { firstName } from "./lib/auth";
import { signedHeaders } from "./lib/hmac";
import type { NotificationType } from "./lib/validators";

// Total attempts = 1 immediate + 3 retries. Delays are applied after each failure.
export const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
// Longer than the n8n workflow's worst case (3 SMTP tries, 2 s apart) against a
// healthy SMTP server, so Convex doesn't retry while n8n is still sending.
const REQUEST_TIMEOUT_MS = 30_000;
// A pending event untouched for this long lost its scheduled job (crash,
// restart, action timeout); the sweeper reschedules it.
const STUCK_AFTER_MS = 5 * 60_000;

/** Everything `deliver` needs, or null when there is nothing left to send. */
export const getDelivery = internalQuery({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .unique();
    if (!event || event.status !== "pending") return null;

    const loan = await ctx.db.get(event.loanId);
    const recipient = await ctx.db.get(event.recipientUserId);
    if (!loan || !recipient) {
      return { kind: "undeliverable" as const, reason: "loan or recipient no longer exists" };
    }
    if (!recipient.email) {
      // The Clerk session token carries no email claim (see README → Clerk setup).
      return { kind: "undeliverable" as const, reason: "recipient has no email address on file" };
    }
    const tool = await ctx.db.get(loan.toolId);

    // Minimal payload: what the email needs and nothing more. No descriptions,
    // no other party's contact details, no internal user ids.
    return {
      kind: "send" as const,
      payload: {
        eventId,
        type: event.type,
      occurredAt: new Date(event._creationTime).toISOString(),
      recipient: { firstName: firstName(recipient.name), email: recipient.email },
      tool: { name: tool?.name ?? "a tool" },
        loan: { id: loan._id, startDate: loan.startDate, endDate: loan.endDate, status: loan.status },
      },
    };
  },
});

/** Sends one outbox event to n8n. Scheduled by the mutation that wrote the event. */
export const deliver = internalAction({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const delivery = await ctx.runQuery(internal.notifications.getDelivery, { eventId });
    if (!delivery) return;
    if (delivery.kind === "undeliverable") {
      await ctx.runMutation(internal.notifications.recordFailure, { eventId, error: delivery.reason, final: true });
      return;
    }
    const { payload } = delivery;

    const error = await postToN8n(JSON.stringify(payload));
    if (error === null) {
      await ctx.runMutation(internal.notifications.markDelivered, { eventId });
    } else {
      // Log ids and the error class only; the payload contains an email address.
      console.warn(`notification ${eventId} (${payload.type}) failed: ${error}`);
      await ctx.runMutation(internal.notifications.recordFailure, { eventId, error });
    }
  },
});

/** Returns null on a 2xx, otherwise a short error description. */
async function postToN8n(body: string): Promise<string | null> {
  const url = process.env.N8N_NOTIFY_WEBHOOK_URL;
  const secret = process.env.CONVEX_TO_N8N_SECRET;
  if (!url || !secret) return "n8n webhook is not configured";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await signedHeaders(secret, body)) },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response.ok ? null : `n8n responded ${response.status}`;
  } catch (e) {
    return e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : "network error";
  }
}

export const markDelivered = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .unique();
    if (!event || event.status !== "pending") return;

    const now = Date.now();
    await ctx.db.patch(event._id, {
      status: "delivered",
      attempts: event.attempts + 1,
      deliveredAt: now,
      nextAttemptAt: undefined,
    });
    await ctx.db.insert("automationEvents", {
      loanId: event.loanId,
      kind: "notification_sent",
      message: `${await recipientRole(ctx, event)} notified: ${TYPE_LABELS[event.type]}`,
      source: "convex",
      externalId: `outbox:${eventId}:sent`,
      createdAt: now,
    });
  },
});

export const recordFailure = internalMutation({
  args: { eventId: v.string(), error: v.string(), final: v.optional(v.boolean()) },
  handler: async (ctx, { eventId, error, final = false }) => {
    const event = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .unique();
    if (!event || event.status !== "pending") return;

    const attempts = event.attempts + 1;
    const now = Date.now();

    if (!final && attempts < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempts - 1];
      await ctx.db.patch(event._id, { attempts, lastError: error, nextAttemptAt: now + delay });
      await ctx.scheduler.runAfter(delay, internal.notifications.deliver, { eventId });
      return;
    }

    // Retries exhausted: park it as failed and make it visible to admins.
    await ctx.db.patch(event._id, { status: "failed", attempts, lastError: error, nextAttemptAt: undefined });
    await ctx.db.insert("automationEvents", {
      loanId: event.loanId,
      kind: "notification_failed",
      message: `Couldn't notify the ${(await recipientRole(ctx, event)).toLowerCase()} after ${attempts} attempts: ${error}`,
      source: "convex",
      externalId: `outbox:${eventId}:failed`,
      createdAt: now,
    });
  },
});

/**
 * Safety net for at-most-once scheduled actions: if `deliver` died before it
 * could record a result, nothing would ever retry it. Runs from crons.ts.
 */
export const sweepStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(500);
    let rescheduled = 0;
    for (const event of pending) {
      const dueAt = event.nextAttemptAt ?? event._creationTime;
      if (now - dueAt < STUCK_AFTER_MS) continue;
      await ctx.db.patch(event._id, { nextAttemptAt: now });
      await ctx.scheduler.runAfter(0, internal.notifications.deliver, { eventId: event.eventId });
      rescheduled++;
    }
    if (rescheduled > 0) console.warn(`outbox sweeper rescheduled ${rescheduled} stuck event(s)`);
    return { rescheduled };
  },
});

const TYPE_LABELS: Record<NotificationType, string> = {
  "loan.requested": "new request",
  "loan.approved": "request approved",
  "loan.declined": "request declined",
  "loan.cancelled": "request cancelled",
  "loan.returned": "loan returned",
};

async function recipientRole(ctx: QueryCtx, event: Doc<"notificationOutbox">): Promise<"Lender" | "Borrower"> {
  const loan = await ctx.db.get(event.loanId);
  return loan?.lenderId === event.recipientUserId ? "Lender" : "Borrower";
}
