import { describe, expect, it } from "vitest";
import {
  computeSignature,
  MAX_SKEW_SECONDS,
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
  timingSafeEqual,
  verifySignature,
} from "./hmac";

const secret = "test-secret-1";
const body = JSON.stringify({ eventId: "e1", type: "loan.requested" });
const now = 1_780_000_000;

async function signed(rawBody = body, timestamp = now) {
  const headers = await signedHeaders(secret, rawBody, timestamp);
  return { timestamp: headers[TIMESTAMP_HEADER], signature: headers[SIGNATURE_HEADER] };
}

describe("hmac", () => {
  it("matches a known HMAC-SHA256 vector", async () => {
    // printf '1700000000.{}' | openssl dgst -sha256 -hmac test-secret-1
    expect(await computeSignature(secret, "1700000000", "{}")).toBe(
      "sha256=fbb8b6b76359b4e00c597565b07b874acdb53b5aabb3c220688a2ff415e7f047",
    );
  });

  it("accepts a valid signature", async () => {
    const h = await signed();
    expect(await verifySignature({ secret, rawBody: body, ...h, now })).toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    const h = await signed();
    const result = await verifySignature({ secret, rawBody: body.replace("e1", "e2"), ...h, now });
    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects the wrong secret", async () => {
    const h = await signed();
    const result = await verifySignature({ secret: "other-secret", rawBody: body, ...h, now });
    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a stale or future timestamp", async () => {
    const old = await signed(body, now - MAX_SKEW_SECONDS - 1);
    expect(await verifySignature({ secret, rawBody: body, ...old, now })).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
    const future = await signed(body, now + MAX_SKEW_SECONDS + 1);
    expect((await verifySignature({ secret, rawBody: body, ...future, now })).ok).toBe(false);
  });

  it("rejects a timestamp swapped onto another signature", async () => {
    const h = await signed();
    const result = await verifySignature({
      secret,
      rawBody: body,
      signature: h.signature,
      timestamp: String(now + 1),
      now,
    });
    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects missing or malformed headers", async () => {
    expect((await verifySignature({ secret, rawBody: body, timestamp: null, signature: "x", now })).ok).toBe(false);
    expect(
      (await verifySignature({ secret, rawBody: body, timestamp: "abc", signature: "sha256=00", now })).ok,
    ).toBe(false);
  });

  it("compares strings without short-circuiting on length mismatches", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
