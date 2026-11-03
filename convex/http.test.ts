import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import { signedHeaders } from "./lib/hmac";
import { createTool, createUser, setup } from "./test.helpers";

const SECRET = "n8n-to-convex-test-secret";
const TODAY = "2026-06-10";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T09:00:00Z`));
  vi.stubEnv("N8N_TO_CONVEX_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

type T = ReturnType<typeof setup>;

async function signedFetch(t: T, path: string, body?: unknown, secret = SECRET) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers = { "Content-Type": "application/json", ...(await signedHeaders(secret, raw)) };
  return body === undefined
    ? t.fetch(path, { method: "GET", headers })
    : t.fetch(path, { method: "POST", headers, body: raw });
}

async function overdueScenario() {
  const t = setup();
  const lender = await createUser(t, { name: "Lena Lender" });
  const borrower = await createUser(t, { name: "Ben Borrower" });
  const toolId = await createTool(t, lender.userId, "Pressure washer");
  const insertLoan = (status: "approved" | "returned", endDate: string) =>
    t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        borrowerId: borrower.userId,
        lenderId: lender.userId,
        startDate: "2026-06-01",
        endDate,
        status,
        createdAt: Date.now(),
      }),
    );
  const overdue = await insertLoan("approved", "2026-06-07");
  await insertLoan("approved", TODAY); // due today, not overdue
  await insertLoan("returned", "2026-06-05"); // already back
  return { t, overdue };
}

describe("signature enforcement", () => {
  it("rejects unsigned, wrongly signed and tampered requests", async () => {
    const { t } = await overdueScenario();

    expect((await t.fetch("/n8n/overdue-loans", { method: "GET" })).status).toBe(401);
    expect((await signedFetch(t, "/n8n/overdue-loans", undefined, "wrong-secret")).status).toBe(401);

    const headers = await signedHeaders(SECRET, JSON.stringify({ a: 1 }));
    const tampered = await t.fetch("/n8n/automation-errors", {
      method: "POST",
      headers,
      body: JSON.stringify({ a: 2 }),
    });
    expect(tampered.status).toBe(401);
  });

  it("rejects a replayed request outside the time window", async () => {
    const { t } = await overdueScenario();
    const raw = "";
    const headers = await signedHeaders(SECRET, raw, Math.floor(Date.now() / 1000) - 301);
    expect((await t.fetch("/n8n/overdue-loans", { method: "GET", headers })).status).toBe(401);
  });

  it("answers 503 when the shared secret isn't configured", async () => {
    const { t } = await overdueScenario();
    vi.stubEnv("N8N_TO_CONVEX_SECRET", "");
    expect((await signedFetch(t, "/n8n/overdue-loans")).status).toBe(503);
  });
});

describe("GET /n8n/overdue-loans", () => {
  it("returns only overdue approved loans with minimal fields", async () => {
    const { t, overdue } = await overdueScenario();
    const response = await signedFetch(t, "/n8n/overdue-loans");
    expect(response.status).toBe(200);
    const { loans } = await response.json();

    expect(loans).toEqual([
      {
        loanId: overdue,
        reminderKey: `${overdue}:${TODAY}`,
        borrower: { firstName: "Ben", email: "ben-borrower@example.com" },
        tool: { name: "Pressure washer" },
        endDate: "2026-06-07",
        daysOverdue: 3,
      },
    ]);
  });
});

describe("POST /n8n/reminders", () => {
  async function postReminder(t: T, loanId: Id<"loans">, status: "sent" | "failed", executionId = "101") {
    return signedFetch(t, "/n8n/reminders", {
      idempotencyKey: `${loanId}:${TODAY}`,
      loanId,
      status,
      executionId,
    });
  }

  it("is idempotent: the same key creates exactly one reminder row", async () => {
    const { t, overdue } = await overdueScenario();

    const first = await postReminder(t, overdue, "sent");
    const second = await postReminder(t, overdue, "sent", "102");

    expect(await first.json()).toEqual({ duplicate: false });
    expect(await second.json()).toEqual({ duplicate: true });
    const reminders = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(reminders).toHaveLength(1);
    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events.map((e) => e.kind)).toEqual(["reminder_sent"]);
  });

  it("drops a sent loan from the next overdue run, but retries a failed one", async () => {
    const { t, overdue } = await overdueScenario();

    await postReminder(t, overdue, "failed");
    let { loans } = await (await signedFetch(t, "/n8n/overdue-loans")).json();
    expect(loans).toHaveLength(1);

    await postReminder(t, overdue, "sent", "103");
    ({ loans } = await (await signedFetch(t, "/n8n/overdue-loans")).json());
    expect(loans).toEqual([]);
    const reminders = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(reminders.map((r) => r.status)).toEqual(["sent"]);
  });

  it("rejects malformed bodies and keys that don't match the loan", async () => {
    const { t, overdue } = await overdueScenario();
    expect((await signedFetch(t, "/n8n/reminders", { loanId: overdue })).status).toBe(400);
    const mismatched = await signedFetch(t, "/n8n/reminders", {
      idempotencyKey: `other:${TODAY}`,
      loanId: overdue,
      status: "sent",
    });
    expect(mismatched.status).toBe(422);
  });
});

describe("POST /n8n/automation-errors", () => {
  it("records a workflow error once per execution", async () => {
    const { t } = await overdueScenario();
    const body = {
      executionId: "77",
      workflowName: "LendLoop · Overdue reminders",
      nodeName: "Send reminder email",
      message: "SMTP connection refused",
    };

    expect(await (await signedFetch(t, "/n8n/automation-errors", body)).json()).toEqual({ duplicate: false });
    expect(await (await signedFetch(t, "/n8n/automation-errors", body)).json()).toEqual({ duplicate: true });

    const events = await t.run((ctx) => ctx.db.query("automationEvents").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "workflow_error", source: "n8n", externalId: "workflow:77" });
  });
});
