import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { firstName, requireAdmin } from "./lib/auth";
import { todayUtc } from "./lib/dates";
import { appError } from "./lib/errors";
import { applyTransition } from "./lib/loanTransitions";
import { userRole } from "./lib/validators";

const LIST_LIMIT = 200;

/**
 * Bootstrap or change a role. Internal on purpose: there is no UI or public API
 * path to escalate privileges. Run from a trusted shell:
 *   npx convex run admin:setRole '{"email":"you@example.com"}'
 */
export const setRole = internalMutation({
  args: { email: v.string(), role: v.optional(userRole) },
  handler: async (ctx, { email, role = "admin" }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();
    if (!user) {
      throw new ConvexError(`No user with email ${email}. Sign in to the app once first.`);
    }
    await ctx.db.patch(user._id, { role });
    return { userId: user._id, role };
  },
});

export const listListings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tools = await ctx.db.query("tools").order("desc").take(LIST_LIMIT);
    return await Promise.all(
      tools.map(async (tool) => ({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        isActive: tool.isActive,
        removedByAdmin: !tool.isActive && tool.removedBy !== undefined && tool.removedBy !== tool.ownerId,
        owner: { firstName: await firstNameOf(ctx, tool.ownerId) },
        createdAt: tool.createdAt,
      })),
    );
  },
});

/**
 * Moderation removal of any listing. Pending requests are declined (and their
 * borrowers notified); approved loans stay open because the tool is still out.
 */
export const removeListing = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const admin = await requireAdmin(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || !tool.isActive) throw appError("NOT_FOUND", "Tool not found");

    await ctx.db.patch(toolId, { isActive: false, removedBy: admin._id, updatedAt: Date.now() });

    const pending = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "pending"))
      .collect();
    for (const loan of pending) {
      await applyTransition(ctx, loan, "declined");
    }
    return { declinedRequests: pending.length };
  },
});

export const listLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").take(LIST_LIMIT);
    const today = todayUtc();
    return await Promise.all(
      loans.map(async (loan) => ({
        _id: loan._id,
        status: loan.status,
        startDate: loan.startDate,
        endDate: loan.endDate,
        isOverdue: loan.status === "approved" && loan.endDate < today,
        tool: { name: (await ctx.db.get(loan.toolId))?.name ?? "Removed tool" },
        borrower: { firstName: await firstNameOf(ctx, loan.borrowerId) },
        lender: { firstName: await firstNameOf(ctx, loan.lenderId) },
      })),
    );
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").take(LIST_LIMIT);
    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      role: user.role,
      trustedLender: user.trustedLender,
    }));
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trustedLender: v.boolean() },
  handler: async (ctx, { userId, trustedLender }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw appError("NOT_FOUND", "User not found");
    await ctx.db.patch(userId, { trustedLender });
  },
});

const HEALTH_LIMIT = 20;

/** Everything that went wrong in the automation layer, newest first. Nothing fails silently. */
export const automationHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const failedOutbox = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(HEALTH_LIMIT);
    const pendingOutbox = await ctx.db
      .query("notificationOutbox")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(HEALTH_LIMIT * 5);
    const failedReminders = await ctx.db
      .query("reminders")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(HEALTH_LIMIT);
    const workflowErrors = await ctx.db
      .query("automationEvents")
      .withIndex("by_kind", (q) => q.eq("kind", "workflow_error"))
      .order("desc")
      .take(HEALTH_LIMIT);

    const toolNameForLoan = async (loanId: Id<"loans">) => {
      const loan = await ctx.db.get(loanId);
      return loan ? ((await ctx.db.get(loan.toolId))?.name ?? "Removed tool") : "Deleted loan";
    };
    const outboxRow = async (event: Doc<"notificationOutbox">) => ({
      _id: event._id,
      type: event.type,
      attempts: event.attempts,
      lastError: event.lastError ?? null,
      nextAttemptAt: event.nextAttemptAt ?? null,
      toolName: await toolNameForLoan(event.loanId),
      at: event._creationTime,
    });

    return {
      failedNotifications: await Promise.all(failedOutbox.map(outboxRow)),
      retryingNotifications: await Promise.all(
        pendingOutbox.filter((e) => e.attempts > 0).slice(0, HEALTH_LIMIT).map(outboxRow),
      ),
      failedReminders: await Promise.all(
        failedReminders.map(async (r) => ({
          _id: r._id,
          day: r.idempotencyKey.split(":")[1] ?? "",
          executionId: r.n8nExecutionId ?? null,
          toolName: await toolNameForLoan(r.loanId),
          at: r.createdAt,
        })),
      ),
      workflowErrors: workflowErrors.map((e) => ({
        _id: e._id,
        message: e.message,
        executionId: e.externalId?.replace(/^workflow:/, "") ?? null,
        at: e.createdAt,
      })),
    };
  },
});

async function firstNameOf(ctx: QueryCtx, userId: Id<"users">) {
  return firstName((await ctx.db.get(userId))?.name ?? "");
}
