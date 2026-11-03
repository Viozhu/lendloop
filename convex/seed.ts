import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { addDays, todayUtc } from "./lib/dates";
import { enqueueNotification } from "./lib/outbox";
import type { LoanStatus, ToolCategory, ToolCondition } from "./lib/validators";

// Demo data for local development. Internal only: `pnpm seed`, or
//   npx convex run seed:run '{"forEmail":"you@example.com"}'
// Demo neighbors have synthetic token identifiers, so nobody can sign in as them.
// With `forEmail` (an account that has signed in once), the seed also gives that
// account an incoming request and an overdue loan, to exercise every workflow.

const DEMO_DOMAIN = "neighbors.lendloop.test";

const NEIGHBORS = [
  { key: "maya", name: "Maya Chen", trustedLender: true },
  { key: "sam", name: "Sam Rivera", trustedLender: false },
  { key: "priya", name: "Priya Patel", trustedLender: true },
  { key: "leo", name: "Leo Martins", trustedLender: false },
] as const;
type NeighborKey = (typeof NEIGHBORS)[number]["key"];

const TOOLS: { key: string; owner: NeighborKey; name: string; category: ToolCategory; condition: ToolCondition; description: string }[] = [
  { key: "washer", owner: "maya", name: "Pressure washer", category: "cleaning", condition: "good", description: "1800 W, with patio cleaner attachment." },
  { key: "trimmer", owner: "maya", name: "Hedge trimmer", category: "garden", condition: "fair", description: "Cordless, battery lasts about 40 minutes." },
  { key: "tilesaw", owner: "maya", name: "Tile saw", category: "power_tools", condition: "good", description: "Wet saw, cuts up to 60 cm tiles." },
  { key: "tent", owner: "leo", name: "4-person tent", category: "camping", condition: "good", description: "Sets up in ten minutes. Includes footprint." },
  { key: "ladder", owner: "priya", name: "Extension ladder", category: "hand_tools", condition: "worn", description: "6 m aluminium. A bit scuffed, perfectly safe." },
  { key: "mixer", owner: "priya", name: "Stand mixer", category: "kitchen", condition: "new", description: "5 L bowl, dough hook and whisk." },
  { key: "drill", owner: "sam", name: "Cordless drill", category: "power_tools", condition: "good", description: "18 V with two batteries and a bit set." },
  { key: "carpet", owner: "leo", name: "Carpet cleaner", category: "cleaning", condition: "fair", description: "Bring your own detergent." },
];

export const run = internalMutation({
  args: { forEmail: v.optional(v.string()) },
  handler: async (ctx, { forEmail }) => {
    const today = todayUtc();
    const already = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", `maya@${DEMO_DOMAIN}`))
      .first();

    const summary: string[] = [];
    if (!already) {
      await seedNeighborhood(ctx, today);
      summary.push(`seeded ${NEIGHBORS.length} neighbors, ${TOOLS.length} tools and 4 loans (1 overdue)`);
    } else {
      summary.push("demo neighborhood already present");
    }

    if (forEmail) summary.push(await seedForUser(ctx, forEmail.trim().toLowerCase(), today));
    return summary.join("; ");
  },
});

async function seedNeighborhood(ctx: MutationCtx, today: string) {
  const users = {} as Record<NeighborKey, Id<"users">>;
  for (const n of NEIGHBORS) {
    users[n.key] = await ctx.db.insert("users", {
      tokenIdentifier: `seed|${n.key}`,
      clerkUserId: `seed_${n.key}`,
      name: n.name,
      email: `${n.key}@${DEMO_DOMAIN}`,
      role: "user",
      trustedLender: n.trustedLender,
      createdAt: Date.now(),
    });
  }

  const tools: Record<string, { id: Id<"tools">; owner: Id<"users"> }> = {};
  for (const t of TOOLS) {
    const now = Date.now();
    const id = await ctx.db.insert("tools", {
      ownerId: users[t.owner],
      name: t.name,
      category: t.category,
      condition: t.condition,
      description: t.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    tools[t.key] = { id, owner: users[t.owner] };
  }

  const loan = (tool: string, borrower: NeighborKey, start: number, end: number, status: LoanStatus) =>
    insertLoan(ctx, tools[tool], users[borrower], addDays(today, start), addDays(today, end), status);

  await loan("washer", "sam", -10, -3, "approved"); // overdue: drives the reminder workflow
  await loan("tent", "priya", -1, 4, "approved"); // currently out
  await loan("ladder", "sam", -20, -15, "returned"); // history
  const pending = await loan("trimmer", "leo", 2, 4, "pending");
  // Goes through the real outbox, so it is delivered to n8n like any request.
  await enqueueNotification(ctx, { loanId: pending, type: "loan.requested", recipientUserId: users.maya });
}

async function seedForUser(ctx: MutationCtx, email: string, today: string): Promise<string> {
  const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).first();
  if (!user) return `no user with email ${email}: sign in once, then re-run`;

  const sam = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", `sam@${DEMO_DOMAIN}`)).first();
  const maya = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", `maya@${DEMO_DOMAIN}`)).first();
  const tileSaw = maya
    ? (await ctx.db.query("tools").withIndex("by_owner", (q) => q.eq("ownerId", maya._id)).collect()).find(
        (t) => t.name === "Tile saw",
      )
    : undefined;
  if (!sam || !maya || !tileSaw) return "demo neighborhood incomplete; skipped personal data";

  const now = Date.now();
  const yourToolId = await ctx.db.insert("tools", {
    ownerId: user._id,
    name: "Circular saw",
    category: "power_tools",
    condition: "good",
    description: "Demo listing created by the seed script.",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const incoming = await insertLoan(ctx, { id: yourToolId, owner: user._id }, sam._id, addDays(today, 1), addDays(today, 3), "pending");
  await enqueueNotification(ctx, { loanId: incoming, type: "loan.requested", recipientUserId: user._id });
  await insertLoan(ctx, { id: tileSaw._id, owner: maya._id }, user._id, addDays(today, -6), addDays(today, -2), "approved");
  return `gave ${email} an incoming request (Circular saw) and an overdue loan (Tile saw)`;
}

async function insertLoan(
  ctx: MutationCtx,
  tool: { id: Id<"tools">; owner: Id<"users"> },
  borrowerId: Id<"users">,
  startDate: string,
  endDate: string,
  status: LoanStatus,
) {
  const now = Date.now();
  return await ctx.db.insert("loans", {
    toolId: tool.id,
    borrowerId,
    lenderId: tool.owner,
    startDate,
    endDate,
    status,
    ...(status === "pending" ? {} : { decidedAt: now }),
    ...(status === "returned" ? { returnedAt: now } : {}),
    createdAt: now,
  });
}
