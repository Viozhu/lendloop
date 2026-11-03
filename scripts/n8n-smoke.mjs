#!/usr/bin/env node
// Sends signed loan events straight to the n8n webhook, without Convex or the
// UI, to check the notification workflow end to end. Emails land in Mailpit.
//
//   node scripts/n8n-smoke.mjs            # valid, duplicate, tampered, stale
//   node scripts/n8n-smoke.mjs unknown    # unknown type -> triggers the error workflow
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../n8n/.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const SECRET = env.CONVEX_TO_N8N_SECRET;
const URL_ = process.env.N8N_NOTIFY_WEBHOOK_URL ?? "http://localhost:5678/webhook/lendloop-loan-events";
if (!SECRET) throw new Error("CONVEX_TO_N8N_SECRET missing from n8n/.env");

function event(type = "loan.requested") {
  return {
    eventId: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    recipient: { firstName: "Sam", email: "sam@example.com" },
    tool: { name: "Smoke-test drill" },
    loan: { id: "smoke-loan", startDate: "2030-01-02", endDate: "2030-01-04", status: "pending" },
  };
}

async function post(name, body, { secret = SECRET, timestamp = Math.floor(Date.now() / 1000), tamper = false } = {}) {
  const raw = JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const sent = tamper ? raw.replace("Smoke-test", "Tampered") : raw;
  const response = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LendLoop-Timestamp": String(timestamp),
      "X-LendLoop-Signature": signature,
    },
    body: sent,
  });
  console.log(`${name.padEnd(28)} -> ${response.status} ${await response.text()}`);
  return response.status;
}

if (process.argv[2] === "unknown") {
  await post("unknown event type", event("loan.exploded"));
} else {
  const valid = event();
  await post("valid loan.requested", valid);
  await post("same eventId again", valid);
  await post("tampered body", event(), { tamper: true });
  await post("wrong secret", event(), { secret: "not-the-secret" });
  await post("stale timestamp", event(), { timestamp: Math.floor(Date.now() / 1000) - 600 });
}
