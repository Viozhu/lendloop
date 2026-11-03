import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { canTransition } from "./lib/loanStateMachine";
import { createTool, createUser, expectCode, setup } from "./test.helpers";

// Fixed "today" so date rules are deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function scenario() {
  const t = setup();
  const lender = await createUser(t, { name: "Lena Lender" });
  const borrower = await createUser(t, { name: "Ben Borrower" });
  const other = await createUser(t, { name: "Mallory Other" });
  const toolId = await createTool(t, lender.userId);
  return { t, lender, borrower, other, toolId };
}

const june = (day: number) => `2026-06-${String(day).padStart(2, "0")}`;

describe("loanStateMachine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("pending", "declined")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("approved", "returned")).toBe(true);

    expect(canTransition("approved", "declined")).toBe(false);
    expect(canTransition("approved", "cancelled")).toBe(false);
    expect(canTransition("pending", "returned")).toBe(false);
    expect(canTransition("returned", "approved")).toBe(false);
    expect(canTransition("declined", "approved")).toBe(false);
  });
});

describe("loans.request", () => {
  it("creates a pending loan with the lender denormalized", async () => {
    const { t, lender, borrower, toolId } = await scenario();
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: june(2),
      endDate: june(4),
    });
    const loan = await t.run((ctx) => ctx.db.get(loanId));
    expect(loan).toMatchObject({ status: "pending", lenderId: lender.userId, borrowerId: borrower.userId });
  });

  it("forbids borrowing your own tool", async () => {
    const { lender, toolId } = await scenario();
    await expectCode(
      lender.as.mutation(api.loans.request, { toolId, startDate: june(2), endDate: june(3) }),
      "FORBIDDEN",
    );
  });

  it("rejects past, inverted and too-long ranges", async () => {
    const { borrower, toolId } = await scenario();
    const ask = (startDate: string, endDate: string) =>
      borrower.as.mutation(api.loans.request, { toolId, startDate, endDate });

    await expectCode(ask("2026-05-31", june(2)), "INVALID_INPUT");
    await expectCode(ask(june(5), june(4)), "INVALID_INPUT");
    await expectCode(ask(june(1), "2026-07-01"), "INVALID_INPUT"); // 31 days
    await expectCode(ask("2026-02-30", june(4)), "INVALID_INPUT");
  });

  it("rejects a duplicate overlapping pending request from the same borrower", async () => {
    const { borrower, toolId } = await scenario();
    await borrower.as.mutation(api.loans.request, { toolId, startDate: june(2), endDate: june(5) });
    await expectCode(
      borrower.as.mutation(api.loans.request, { toolId, startDate: june(4), endDate: june(6) }),
      "CONFLICT",
    );
  });
});

describe("loan transitions RBAC", () => {
  async function pendingLoan() {
    const s = await scenario();
    const loanId = await s.borrower.as.mutation(api.loans.request, {
      toolId: s.toolId,
      startDate: june(2),
      endDate: june(4),
    });
    return { ...s, loanId };
  }

  it("only the lender can approve, decline or mark returned", async () => {
    const { borrower, other, loanId } = await pendingLoan();
    for (const as of [borrower.as, other.as]) {
      await expectCode(as.mutation(api.loans.approve, { loanId }), "FORBIDDEN");
      await expectCode(as.mutation(api.loans.decline, { loanId }), "FORBIDDEN");
      await expectCode(as.mutation(api.loans.markReturned, { loanId }), "FORBIDDEN");
    }
  });

  it("only the borrower can cancel", async () => {
    const { lender, other, loanId } = await pendingLoan();
    await expectCode(lender.as.mutation(api.loans.cancel, { loanId }), "FORBIDDEN");
    await expectCode(other.as.mutation(api.loans.cancel, { loanId }), "FORBIDDEN");
  });

  it("walks the happy path and refuses invalid transitions", async () => {
    const { t, lender, borrower, loanId } = await pendingLoan();

    await expectCode(lender.as.mutation(api.loans.markReturned, { loanId }), "INVALID_TRANSITION");
    await lender.as.mutation(api.loans.approve, { loanId });
    await expectCode(borrower.as.mutation(api.loans.cancel, { loanId }), "INVALID_TRANSITION");
    await expectCode(lender.as.mutation(api.loans.decline, { loanId }), "INVALID_TRANSITION");
    await lender.as.mutation(api.loans.markReturned, { loanId });
    await expectCode(lender.as.mutation(api.loans.approve, { loanId }), "INVALID_TRANSITION");

    const loan = await t.run((ctx) => ctx.db.get(loanId));
    expect(loan?.status).toBe("returned");
    expect(loan?.returnedAt).toBeTypeOf("number");
  });

  it("rejects approving a loan that overlaps an approved one", async () => {
    const { lender, borrower, other, toolId, loanId } = await pendingLoan();
    const overlapping = await other.as.mutation(api.loans.request, {
      toolId,
      startDate: june(3),
      endDate: june(6),
    });
    const later = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: june(10),
      endDate: june(12),
    });

    await lender.as.mutation(api.loans.approve, { loanId });
    await expectCode(lender.as.mutation(api.loans.approve, { loanId: overlapping }), "CONFLICT");
    await lender.as.mutation(api.loans.approve, { loanId: later });
  });
});

describe("transactional outbox", () => {
  async function outboxFor(t: Awaited<ReturnType<typeof scenario>>["t"], loanId: Id<"loans">) {
    return await t.run((ctx) =>
      ctx.db
        .query("notificationOutbox")
        .filter((q) => q.eq(q.field("loanId"), loanId))
        .collect(),
    );
  }

  it("writes one outbox row per status change, addressed to the right party", async () => {
    const { t, lender, borrower, toolId } = await scenario();
    const loanId = await borrower.as.mutation(api.loans.request, {
      toolId,
      startDate: june(2),
      endDate: june(4),
    });
    await lender.as.mutation(api.loans.approve, { loanId });

    const rows = await outboxFor(t, loanId);
    expect(rows.map((r) => [r.type, r.recipientUserId, r.status])).toEqual([
      ["loan.requested", lender.userId, "pending"],
      ["loan.approved", borrower.userId, "pending"],
    ]);
  });

  it("writes no outbox row when the status change is rejected", async () => {
    const { t, lender, borrower, other, toolId } = await scenario();
    const first = await borrower.as.mutation(api.loans.request, { toolId, startDate: june(2), endDate: june(4) });
    const second = await other.as.mutation(api.loans.request, { toolId, startDate: june(3), endDate: june(5) });
    await lender.as.mutation(api.loans.approve, { loanId: first });

    await expectCode(lender.as.mutation(api.loans.approve, { loanId: second }), "CONFLICT");

    const rows = await outboxFor(t, second);
    expect(rows.map((r) => r.type)).toEqual(["loan.requested"]);
    expect((await t.run((ctx) => ctx.db.get(second)))?.status).toBe("pending");
  });
});

describe("loan lists", () => {
  it("shows each party only first names and their own side", async () => {
    const { lender, borrower, other, toolId } = await scenario();
    await borrower.as.mutation(api.loans.request, { toolId, startDate: june(2), endDate: june(4) });

    const [mine] = await borrower.as.query(api.loans.listMyRequests, {});
    expect(mine.lender).toEqual({ firstName: "Lena" });
    expect(JSON.stringify(mine)).not.toContain("@");

    const [incoming] = await lender.as.query(api.loans.listIncoming, {});
    expect(incoming.borrower).toEqual({ firstName: "Ben" });
    expect(await other.as.query(api.loans.listIncoming, {})).toEqual([]);
  });
});
