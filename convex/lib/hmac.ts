// HMAC-SHA256 request signing shared by both directions of the n8n integration.
// Web Crypto only, so it runs unchanged in the Convex runtime, Node and tests.
//
//   X-LendLoop-Timestamp: <unix seconds>
//   X-LendLoop-Signature: sha256=<hex HMAC_SHA256(secret, `${timestamp}.${rawBody}`)>
//
// The timestamp is part of the signed message, so it can't be swapped, and the
// verifier rejects anything older or newer than MAX_SKEW_SECONDS (replay window).

export const TIMESTAMP_HEADER = "X-LendLoop-Timestamp";
export const SIGNATURE_HEADER = "X-LendLoop-Signature";
export const MAX_SKEW_SECONDS = 300;

const SIGNATURE_PREFIX = "sha256=";
const encoder = new TextEncoder();

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function hmacHex(secret: string, message: string): Promise<string> {
  if (!secret) throw new Error("HMAC secret is empty");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeSignature(secret: string, timestamp: string, rawBody: string) {
  return SIGNATURE_PREFIX + (await hmacHex(secret, `${timestamp}.${rawBody}`));
}

/** Headers to attach to an outgoing request whose body is exactly `rawBody`. */
export async function signedHeaders(
  secret: string,
  rawBody: string,
  timestamp: number = nowSeconds(),
): Promise<Record<string, string>> {
  const ts = String(timestamp);
  return {
    [TIMESTAMP_HEADER]: ts,
    [SIGNATURE_HEADER]: await computeSignature(secret, ts, rawBody),
  };
}

/** Compares in time that depends only on length, which is public (fixed-size hex). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_timestamp" | "stale_timestamp" | "bad_signature" };

export async function verifySignature(opts: {
  secret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  now?: number;
}): Promise<VerifyResult> {
  const { secret, rawBody, timestamp, signature, now = nowSeconds() } = opts;
  if (!timestamp || !signature) return { ok: false, reason: "missing_headers" };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  const expected = await computeSignature(secret, timestamp, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase())
    ? { ok: true }
    : { ok: false, reason: "bad_signature" };
}
