import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createTool, createUser, expectCode, setup } from "./test.helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  vi.stubEnv("N8N_NOTIFY_WEBHOOK_URL", "http://n8n.test/webhook");
  vi.stubEnv("CONVEX_TO_N8N_SECRET", "secret");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function requested() {
  const t = setup();
  const admin = await createUser(t, { name: "Ada Admin", role: "admin" });
  const lender = await createUser(t, { name: "Lena Lender" });
  const borrower = await createUser(t, { name: "Ben Borrower" });
  const toolId = await createTool(t, lender.userId);
  await borrower.as.mutation(api.loans.request, { toolId, startDate: "2026-06-02", endDate: "2026-06-03" });
  const [event] = await t.run((ctx) => ctx.db.query("notificationOutbox").collect());
  return { t, admin, lender, borrower, event };
}

describe("loan activity feed", () => {
  it("shows a delivered notification to both parties", async () => {
    const { t, lender, borrower, event } = await requested();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    await t.action(internal.notifications.deliver, { eventId: event.eventId });

    const [mine] = await borrower.as.query(api.loans.listMyRequests, {});
    expect(mine.activity).toEqual([{ label: "Lender notified", tone: "ok", at: expect.any(Number) }]);
    const [incoming] = await lender.as.query(api.loans.listIncoming, {});
    expect(incoming.activity[0].label).toBe("Lender notified");
  });

  it("shows a retrying delivery without leaking the internal error", async () => {
    const { t, borrower, event } = await requested();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await t.action(internal.notifications.deliver, { eventId: event.eventId });

    const [mine] = await borrower.as.query(api.loans.listMyRequests, {});
    expect(mine.activity).toEqual([{ label: "Notification failed – retrying", tone: "warn", at: expect.any(Number) }]);
    expect(JSON.stringify(mine)).not.toContain("503");
  });
});

describe("admin.automationHealth", () => {
  it("is admin-only", async () => {
    const { lender } = await requested();
    await expectCode(lender.as.query(api.admin.automationHealth, {}), "FORBIDDEN");
  });

  it("lists failed deliveries, failed reminders and workflow errors", async () => {
    const { t, admin, event } = await requested();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    for (let i = 0; i < 4; i++) {
      await t.action(internal.notifications.deliver, { eventId: event.eventId });
    }
    await t.mutation(internal.automation.recordReminder, {
      idempotencyKey: `${event.loanId}:2026-06-01`,
      loanId: event.loanId,
      status: "failed",
      executionId: "9",
    });
    await t.mutation(internal.automation.recordWorkflowError, {
      executionId: "42",
      workflowName: "LendLoop · Overdue reminders",
      message: "connect ECONNREFUSED",
    });

    const health = await admin.as.query(api.admin.automationHealth, {});

    expect(health.failedNotifications).toMatchObject([
      { type: "loan.requested", attempts: 4, lastError: "n8n responded 503", toolName: "Cordless drill" },
    ]);
    expect(health.retryingNotifications).toEqual([]);
    expect(health.failedReminders).toMatchObject([{ day: "2026-06-01", executionId: "9" }]);
    expect(health.workflowErrors).toMatchObject([{ executionId: "42" }]);
  });
});

describe("seed", () => {
  it("builds the demo neighborhood once, with an overdue loan and a queued request", async () => {
    const t = setup();
    await t.mutation(internal.seed.run, {});
    const again = await t.mutation(internal.seed.run, {});

    expect(again).toContain("already present");
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(4);
    const loans = await t.run((ctx) => ctx.db.query("loans").collect());
    expect(loans.filter((l) => l.status === "approved" && l.endDate < "2026-06-01")).toHaveLength(1);
    const outbox = await t.run((ctx) => ctx.db.query("notificationOutbox").collect());
    expect(outbox.map((e) => e.type)).toEqual(["loan.requested"]);
  });

  it("adds personal demo data for a signed-in account", async () => {
    const t = setup();
    const me = await createUser(t, { name: "Real Person" });
    await t.mutation(internal.seed.run, {});
    const result = await t.mutation(internal.seed.run, { forEmail: "Real-Person@example.com" });

    expect(result).toContain("incoming request");
    const [incoming] = await me.as.query(api.loans.listIncoming, {});
    expect(incoming).toMatchObject({ status: "pending", tool: { name: "Circular saw" } });
    const [borrowed] = await me.as.query(api.loans.listMyRequests, {});
    expect(borrowed).toMatchObject({ status: "approved", isOverdue: true });
  });
});
