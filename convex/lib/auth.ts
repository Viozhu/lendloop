import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";

type Ctx = QueryCtx | MutationCtx;

/** The stored user for the current identity, or null. Never trusts client-supplied ids. */
export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw appError("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw appError("FORBIDDEN", "Admin only");
  return user;
}

export async function requireToolOwner(
  ctx: Ctx,
  toolId: Id<"tools">,
): Promise<{ user: Doc<"users">; tool: Doc<"tools"> }> {
  const user = await requireUser(ctx);
  const tool = await ctx.db.get(toolId);
  if (!tool || !tool.isActive) throw appError("NOT_FOUND", "Tool not found");
  if (tool.ownerId !== user._id) throw appError("FORBIDDEN", "Not the tool owner");
  return { user, tool };
}

export async function requireLoanParty(
  ctx: Ctx,
  loanId: Id<"loans">,
  party: "lender" | "borrower",
): Promise<{ user: Doc<"users">; loan: Doc<"loans"> }> {
  const user = await requireUser(ctx);
  const loan = await ctx.db.get(loanId);
  if (!loan) throw appError("NOT_FOUND", "Loan not found");
  const partyId = party === "lender" ? loan.lenderId : loan.borrowerId;
  if (partyId !== user._id) throw appError("FORBIDDEN", `Not the ${party} of this loan`);
  return { user, loan };
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "Neighbor";
}
