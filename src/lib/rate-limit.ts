import "server-only";

// ----------------------------------------------------------------------
// In-memory IP rate limiter — best-effort defense against
// brute-force / DDoS on cheap-to-call routes (Telegram callback,
// push subscribe, etc.).
//
// Vercel functions are stateless across invocations, so this is NOT
// a strong global limiter — a single attacker on multiple regions
// can amplify their effective rate. But it IS a working per-region
// per-warm-invocation limiter that catches the common "spray from
// one box" attack and adds a CPU cost ceiling per warm container.
// For real DDoS we layer Vercel's edge protection + Cloudflare in
// front; this is the application-level guardrail.
//
// API surface:
//   const ok = checkRateLimit("auth-callback", ip, 5, 5 * 60 * 1000);
// where: bucket name + key + max-events + window-ms.

type Entry = { count: number; expiresAt: number };

const STORE: Map<string, Entry> = new Map();

// Rough size cap so a flood of unique keys (different IPs) doesn't
// grow the map unbounded across long-lived warm containers. When we
// hit the cap we drop the oldest by expiry; cheap O(n) scan is fine
// for our scale.
const MAX_KEYS = 5000;

function evictOldestIfNeeded(): void {
  if (STORE.size < MAX_KEYS) return;
  let oldest: { key: string; expiresAt: number } | null = null;
  for (const [k, v] of STORE.entries()) {
    if (oldest === null || v.expiresAt < oldest.expiresAt) {
      oldest = { key: k, expiresAt: v.expiresAt };
    }
  }
  if (oldest) STORE.delete(oldest.key);
}

export function checkRateLimit(
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const composite = `${bucket}:${key}`;
  const existing = STORE.get(composite);
  if (!existing || existing.expiresAt <= now) {
    evictOldestIfNeeded();
    STORE.set(composite, { count: 1, expiresAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetMs: windowMs };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      remaining: 0,
      resetMs: existing.expiresAt - now,
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: max - existing.count,
    resetMs: existing.expiresAt - now,
  };
}

/**
 * Best-effort client IP from a Next.js request. Vercel sets
 * x-forwarded-for; falls back to x-real-ip and finally to "unknown"
 * so the limiter still works (just shares one bucket across
 * unidentifiable callers).
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
