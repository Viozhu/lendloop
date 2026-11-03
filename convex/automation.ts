import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { firstName } from "./lib/auth";
import { daysBetween, isIsoDate } from "./lib/dates";
import { reminderStatus } from "./lib/validators";

const OVERDUE_BATCH_LIMIT = 200;

function reminderKey(loanId: string, day: string): string {
  return `${loanId}:${day}`;
}

/**
 * Approved loans past their end date that haven't had a successful reminder
 * today. Failed reminders are retried on the next run.
 */
export const overdueLoans = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const loans = ctx.db
      .query("loans")
      .withIndex("by_status_endDate", (q) => q.eq("status", "approved").lt("endDate", today));

    // The limit counts loans still due today, so already-reminded loans can't
    // crowd newer ones out of the batch.
    const due = [];
    for await (const loan of loans) {
      if (due.length >= OVERDUE_BATCH_LIMIT) break;
      const key = reminderKey(loan._id, today);
      const existing = await ctx.db
        .query("reminders")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
        .unique();
      if (existing?.status === "sent") continue;

      const borrower = await ctx.db.get(loan.borrowerId);
      const tool = await ctx.db.get(loan.toolId);
      if (!borrower) continue;
      due.push({
        loanId: loan._id,
        reminderKey: key,
        borrower: { firstName: firstName(borrower.name), email: borrower.email },
        tool: { name: tool?.name ?? "a tool" },
        endDate: loan.endDate,
        daysOverdue: daysBetween(loan.endDate, today),
      });
    }
    return due;
  },
});

/**
 * Idempotent write-back from the reminders workflow. Mutations are serializable,
 * so "look up by key, insert if absent" can't double-insert under concurrency.
 * A failed reminder may later be upgraded to sent by a retry; a sent one is final.
 */
export const recordReminder = internalMutation({
  args: {
    idempotencyKey: v.string(),
    loanId: v.string(),
    status: reminderStatus,
    executionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loanId = ctx.db.normalizeId("loans", args.loanId);
    const [keyLoan, keyDay] = args.idempotencyKey.split(":");
    if (!loanId || keyLoan !== args.loanId || !keyDay || !isIsoDate(keyDay)) {
      return { ok: false as const, error: "invalid_reminder" };
    }
    if (!(await ctx.db.get(loanId))) return { ok: false as const, error: "unknown_loan" };

    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();

    if (existing && (existing.status === "sent" || args.status === "failed")) {
      return { ok: true as const, duplicate: true };
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { status: args.status, n8nExecutionId: args.executionId });
    } else {
      await ctx.db.insert("reminders", {
        idempotencyKey: args.idempotencyKey,
        loanId,
        status: args.status,
        channel: "email",
        n8nExecutionId: args.executionId,
        createdAt: now,
      });
    }

    await appendEventOnce(ctx, {
      loanId,
      kind: args.status === "sent" ? "reminder_sent" : "reminder_failed",
      message: args.status === "sent" ? "Overdue reminder sent" : "Overdue reminder failed",
      externalId: `reminder:${args.idempotencyKey}:${args.status}`,
      createdAt: now,
    });
    return { ok: true as const, duplicate: false };
  },
});

/** Ingests a failure reported by the n8n error workflow. Deduped per execution. */
export const recordWorkflowError = internalMutation({
  args: {
    executionId: v.string(),
    workflowName: v.string(),
    nodeName: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, { executionId, workflowName, nodeName, message }) => {
    const inserted = await appendEventOnce(ctx, {
      kind: "workflow_error",
      message: `${workflowName}${nodeName ? ` › ${nodeName}` : ""}: ${message}`.slice(0, 500),
      externalId: `workflow:${executionId}`,
      createdAt: Date.now(),
    });
    return { duplicate: !inserted };
  },
});

async function appendEventOnce(
  ctx: MutationCtx,
  event: {
    loanId?: Id<"loans">;
    kind: "reminder_sent" | "reminder_failed" | "workflow_error";
    message: string;
    externalId: string;
    createdAt: number;
  },
): Promise<boolean> {
  const seen = await ctx.db
    .query("automationEvents")
    .withIndex("by_externalId", (q) => q.eq("externalId", event.externalId))
    .first();
  if (seen) return false;
  await ctx.db.insert("automationEvents", { ...event, source: "n8n" });
  return true;
}
