import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createTool, createUser, expectCode, setup } from "./test.helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function scenario() {
  const t = setup();
  const admin = await createUser(t, { name: "Ada Admin", role: "admin" });
  const owner = await createUser(t, { name: "Olivia Owner" });
  const borrower = await createUser(t, { name: "Ben Borrower" });
  const toolId = await createTool(t, owner.userId);
  return { t, admin, owner, borrower, toolId };
}

describe("admin RBAC", () => {
  it("rejects regular users on every admin function", async () => {
    const { owner, borrower, toolId } = await scenario();
    await expectCode(owner.as.query(api.admin.listListings, {}), "FORBIDDEN");
    await expectCode(owner.as.query(api.admin.listLoans, {}), "FORBIDDEN");
    await expectCode(owner.as.query(api.admin.listUsers, {}), "FORBIDDEN");
    await expectCode(owner.as.mutation(api.admin.removeListing, { toolId }), "FORBIDDEN");
    await expectCode(
      owner.as.mutation(api.admin.setTrustedLender, { userId: borrower.userId, trustedLender: true }),
      "FORBIDDEN",
    );
  });

  it("lets an admin remove any listing and declines its pending requests", async () => {
    const { t, admin, borrower, toolId } = await scenario();
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: "2026-06-02",
      endDate: "2026-06-03",
    });

    const result = await admin.as.mutation(api.admin.removeListing, { toolId });

    expect(result).toEqual({ declinedRequests: 1 });
    const tool = await t.run((ctx) => ctx.db.get(toolId));
    expect(tool).toMatchObject({ isActive: false, removedBy: admin.userId });
    expect((await t.run((ctx) => ctx.db.get(loanId)))?.status).toBe("declined");
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);

    const [listing] = await admin.as.query(api.admin.listListings, {});
    expect(listing.removedByAdmin).toBe(true);
  });

  it("lets an admin toggle Trusted Lender", async () => {
    const { t, admin, owner } = await scenario();
    await admin.as.mutation(api.admin.setTrustedLender, { userId: owner.userId, trustedLender: true });
    expect((await t.run((ctx) => ctx.db.get(owner.userId)))?.trustedLender).toBe(true);
  });
});

describe("admin.setRole (internal, CLI only)", () => {
  it("promotes a user by email", async () => {
    const { t, owner } = await scenario();
    await t.mutation(internal.admin.setRole, { email: "olivia-owner@example.com" });
    expect((await t.run((ctx) => ctx.db.get(owner.userId)))?.role).toBe("admin");
  });

  it("is not reachable through the public API", () => {
    // Enforced by `pnpm typecheck`: the public API has no setRole reference.
    // @ts-expect-error setRole is an internalMutation
    void api.admin.setRole;
  });
});
