import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from "./lib/hmac";
import { createTool, createUser, setup } from "./test.helpers";

const SECRET = "convex-to-n8n-test-secret";
const WEBHOOK = "http://n8n.test/webhook/lendloop-loan-events";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  vi.stubEnv("N8N_NOTIFY_WEBHOOK_URL", WEBHOOK);
  vi.stubEnv("CONVEX_TO_N8N_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function requestedLoan() {
  const t = setup();
  const lender = await createUser(t, { name: "Lena Lender" });
  const borrower = await createUser(t, { name: "Ben Borrower" });
  const toolId = await createTool(t, lender.userId);
  await borrower.as.mutation(api.loans.request, { toolId, startDate: "2026-06-02", endDate: "2026-06-04" });
  const [event] = await t.run((ctx) => ctx.db.query("notificationOutbox").collect());
  return { t, event };
}

describe("notifications.deliver", () => {
  it("posts a signed, minimal payload and marks the event delivered", async () => {
    const { t, event } = await requestedLoan();
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await t.action(internal.notifications.deliver, { eventId: event.eventId });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    const headers = init.headers as Record<string, string>;
    const rawBody = init.body as string;
    const verified = await verifySignature({
      secret: SECRET,
      rawBody,
      timestamp: headers[TIMESTAMP_HEADER],
      signature: headers[SIGNATURE_HEADER],
    });
    expect(verified).toEqual({ ok: true });

    const payload = JSON.parse(rawBody);
    expect(Object.keys(payload).sort()).toEqual(["eventId", "loan", "occurredAt", "recipient", "tool", "type"]);
    expect(payload.recipient).toEqual({ firstName: "Lena", email: "lena-lender@example.com" });
    expect(payload.tool).toEqual({ name: "Cordless drill" });
    expect(Object.keys(payload.loan).sort()).toEqual(["endDate", "id", "startDate", "status"]);
    expect(rawBody).not.toContain("ben-borrower@example.com");
    expect(rawBody).not.toContain("18V"); // tool description stays out

    const stored = await t.run((ctx) => ctx.db.get(event._id));
    expect(stored).toMatchObject({ status: "delivered", attempts: 1 });
    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events.map((e) => [e.kind, e.message])).toEqual([["notification_sent", "Lender notified: new request"]]);
  });

  it("retries with backoff, then parks the event as failed", async () => {
    const { t, event } = await requestedLoan();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    for (let attempt = 1; attempt <= 3; attempt++) {
      await t.action(internal.notifications.deliver, { eventId: event.eventId });
      const stored = await t.run((ctx) => ctx.db.get(event._id));
      expect(stored).toMatchObject({ status: "pending", attempts: attempt, lastError: "n8n responded 500" });
      expect(stored?.nextAttemptAt).toBeGreaterThan(Date.now());
    }

    await t.action(internal.notifications.deliver, { eventId: event.eventId });

    const stored = await t.run((ctx) => ctx.db.get(event._id));
    expect(stored).toMatchObject({ status: "failed", attempts: 4 });
    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events.map((e) => e.kind)).toEqual(["notification_failed"]);

    // A failed event is final: further deliveries are no-ops.
    await t.action(internal.notifications.deliver, { eventId: event.eventId });
    expect((await t.run((ctx) => ctx.db.get(event._id)))?.attempts).toBe(4);
  });

  it("treats missing configuration as a delivery failure, not a crash", async () => {
    const { t, event } = await requestedLoan();
    vi.stubEnv("N8N_NOTIFY_WEBHOOK_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await t.action(internal.notifications.deliver, { eventId: event.eventId });

    expect(fetchMock).not.toHaveBeenCalled();
    const stored = await t.run((ctx) => ctx.db.get(event._id));
    expect(stored).toMatchObject({ attempts: 1, lastError: "n8n webhook is not configured" });
  });

  it("schedules the first delivery in the same transaction as the status change", async () => {
    const { t } = await requestedLoan();
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toEqual(["notifications:deliver"]);
  });
});
