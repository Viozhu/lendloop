import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { loanActivity } from "./lib/activity";
import { firstName, requireLoanParty, requireUser } from "./lib/auth";
import { rangesOverlap, todayUtc } from "./lib/dates";
import { appError } from "./lib/errors";
import { loanDatesError } from "./lib/loanRules";
import { assertTransition } from "./lib/loanStateMachine";
import { applyTransition } from "./lib/loanTransitions";
import { enqueueNotification } from "./lib/outbox";
import type { LoanStatus } from "./lib/validators";

const LIST_LIMIT = 100;

export const request = mutation({
  args: { toolId: v.id("tools"), startDate: v.string(), endDate: v.string() },
  handler: async (ctx, { toolId, startDate, endDate }) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || !tool.isActive) throw appError("NOT_FOUND", "Tool not found");
    if (tool.ownerId === user._id) throw appError("FORBIDDEN", "You can't borrow your own tool");

    const datesError = loanDatesError(startDate, endDate, todayUtc());
    if (datesError) throw appError("INVALID_INPUT", datesError);

    const myPending = await loansWithStatus(ctx, toolId, "pending");
    const duplicate = myPending.some(
      (loan) =>
        loan.borrowerId === user._id && rangesOverlap(loan.startDate, loan.endDate, startDate, endDate),
    );
    if (duplicate) {
      throw appError("CONFLICT", "You already have a pending request for those dates");
    }

    const loanId = await ctx.db.insert("loans", {
      toolId,
      borrowerId: user._id,
      lenderId: tool.ownerId,
      startDate,
      endDate,
      status: "pending",
      createdAt: Date.now(),
    });
    await enqueueNotification(ctx, { loanId, type: "loan.requested", recipientUserId: tool.ownerId });
    return loanId;
  },
});

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    assertTransition(loan.status, "approved");

    const tool = await ctx.db.get(loan.toolId);
    if (!tool || !tool.isActive) throw appError("CONFLICT", "This tool is no longer listed");
    if (loan.endDate < todayUtc()) throw appError("CONFLICT", "The requested dates have already passed");

    // Checked inside the mutation: Convex serializes conflicting transactions,
    // so two concurrent approvals for overlapping dates can't both commit.
    const approved = await loansWithStatus(ctx, loan.toolId, "approved");
    if (approved.some((o) => rangesOverlap(o.startDate, o.endDate, loan.startDate, loan.endDate))) {
      throw appError("CONFLICT", "Those dates overlap a loan you already approved");
    }

    await applyTransition(ctx, loan, "approved");
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    await applyTransition(ctx, loan, "declined");
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "borrower");
    await applyTransition(ctx, loan, "cancelled");
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const { loan } = await requireLoanParty(ctx, loanId, "lender");
    await applyTransition(ctx, loan, "returned");
  },
});

/** Loans where the caller is the borrower ("My requests"). */
export const listMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .take(LIST_LIMIT);

    const today = todayUtc();
    return await Promise.all(
      loans.map(async (loan) => ({
        ...loanSummary(loan, today),
        tool: { name: (await ctx.db.get(loan.toolId))?.name ?? "Removed tool" },
        lender: { firstName: await firstNameOf(ctx, loan.lenderId) },
        activity: await loanActivity(ctx, loan._id),
      })),
    );
  },
});

/** Loans on the caller's tools ("Incoming"). */
export const listIncoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
      .order("desc")
      .take(LIST_LIMIT);

    const today = todayUtc();
    return await Promise.all(
      loans.map(async (loan) => {
        const borrower = await ctx.db.get(loan.borrowerId);
        return {
          ...loanSummary(loan, today),
          tool: { name: (await ctx.db.get(loan.toolId))?.name ?? "Removed tool" },
          borrower: { firstName: firstName(borrower?.name ?? "") },
          activity: await loanActivity(ctx, loan._id),
          // Lets the UI explain why approving would fail before the lender tries.
          conflictsWithApproved:
            loan.status === "pending" &&
            (await loansWithStatus(ctx, loan.toolId, "approved")).some((o) =>
              rangesOverlap(o.startDate, o.endDate, loan.startDate, loan.endDate),
            ),
        };
      }),
    );
  },
});

async function loansWithStatus(ctx: QueryCtx, toolId: Id<"tools">, status: LoanStatus) {
  return await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", status))
    .collect();
}

async function firstNameOf(ctx: QueryCtx, userId: Id<"users">) {
  return firstName((await ctx.db.get(userId))?.name ?? "");
}

function loanSummary(loan: Doc<"loans">, today: string) {
  return {
    _id: loan._id,
    status: loan.status,
    startDate: loan.startDate,
    endDate: loan.endDate,
    createdAt: loan.createdAt,
    isOverdue: loan.status === "approved" && loan.endDate < today,
  };
}
