import { mutation, query } from "./_generated/server";
import { firstName, getCurrentUser } from "./lib/auth";
import { appError } from "./lib/errors";

/**
 * Creates or refreshes the caller's user row after sign-in. Takes no arguments:
 * identity comes only from the verified Clerk JWT, and role/trustedLender are
 * never writable from here.
 */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("UNAUTHENTICATED");

    const email = (identity.email ?? "").toLowerCase();
    const name =
      identity.name ?? identity.givenName ?? identity.nickname ?? (email.split("@")[0] || "Neighbor");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (existing) {
      if (existing.name !== name || existing.email !== email) {
        await ctx.db.patch(existing._id, { name, email });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      name,
      email,
      role: "user",
      trustedLender: false,
      createdAt: Date.now(),
    });
  },
});

/** The caller's own profile. The only place a user's email reaches the client. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      firstName: firstName(user.name),
      email: user.email,
      role: user.role,
      trustedLender: user.trustedLender,
    };
  },
});
