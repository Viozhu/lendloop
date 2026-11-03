import { httpRouter } from "convex/server";
import { z } from "zod";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import { todayUtc } from "./lib/dates";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from "./lib/hmac";

// Endpoints called by n8n. Every request must carry a valid HMAC signature made
// with N8N_TO_CONVEX_SECRET over the raw body (see lib/hmac.ts).

const MAX_BODY_BYTES = 16 * 1024;

const reminderBody = z.object({
  idempotencyKey: z.string().min(1).max(100),
  loanId: z.string().min(1).max(64),
  status: z.enum(["sent", "failed"]),
  executionId: z.string().max(64).optional(),
});

const workflowErrorBody = z.object({
  executionId: z.string().min(1).max(64),
  workflowName: z.string().min(1).max(200),
  nodeName: z.string().max(200).optional(),
  message: z.string().min(1).max(2000),
});

type SignedHandler = (ctx: ActionCtx, rawBody: string) => Promise<Response>;

/** Reads the raw body, verifies the signature, and only then runs `handler`. */
function signed(handler: SignedHandler) {
  return httpAction(async (ctx, request) => {
    const secret = process.env.N8N_TO_CONVEX_SECRET;
    if (!secret) return json(503, { error: "not_configured" });

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return json(413, { error: "body_too_large" });
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: "body_too_large" });

    const result = await verifySignature({
      secret,
      rawBody,
      timestamp: request.headers.get(TIMESTAMP_HEADER),
      signature: request.headers.get(SIGNATURE_HEADER),
    });
    if (!result.ok) {
      // The reason is logged for operators but not returned to the caller.
      console.warn(`rejected n8n request to ${new URL(request.url).pathname}: ${result.reason}`);
      return json(401, { error: "invalid_signature" });
    }
    return handler(ctx, rawBody);
  });
}

function parseJson<T>(schema: z.ZodType<T>, rawBody: string): T | null {
  try {
    const result = schema.safeParse(JSON.parse(rawBody));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const http = httpRouter();

http.route({
  path: "/n8n/overdue-loans",
  method: "GET",
  handler: signed(async (ctx) => {
    const today = todayUtc();
    const loans = await ctx.runQuery(internal.automation.overdueLoans, { today });
    return json(200, { today, loans });
  }),
});

http.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: signed(async (ctx, rawBody) => {
    const body = parseJson(reminderBody, rawBody);
    if (!body) return json(400, { error: "invalid_body" });
    const result = await ctx.runMutation(internal.automation.recordReminder, body);
    if (!result.ok) return json(422, { error: result.error });
    return json(200, { duplicate: result.duplicate });
  }),
});

http.route({
  path: "/n8n/automation-errors",
  method: "POST",
  handler: signed(async (ctx, rawBody) => {
    const body = parseJson(workflowErrorBody, rawBody);
    if (!body) return json(400, { error: "invalid_body" });
    const result = await ctx.runMutation(internal.automation.recordWorkflowError, body);
    return json(200, result);
  }),
});

export default http;
