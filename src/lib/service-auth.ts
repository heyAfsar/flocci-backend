import type { NextRequest } from 'next/server';

/**
 * Service-to-service auth for the admin API — lets sibling Flocci services
 * (e.g. `flocci-panel-srv`) call `/api/admin/*` without a browser session by
 * presenting `X-Flocci-Service-Key` instead. Mirrors the header contract
 * `identityFetch`/`nodemailer` already use to call OUT to other services
 * (see lib/identity.ts) — this is the same shape, inbound.
 *
 * IMPORTANT: this module's top level stays free of `./admin` (which pulls in
 * `./supabase`, whose module-scope `makeClient()` throws at import time when
 * DB_TARGET isn't 'vps' and Supabase envs are unset). `middleware.ts` needs
 * `isServiceCall` on a static import, and a throw during module evaluation
 * happens before any try/catch can see it — that class of bug took the whole
 * API down once (see the FAIL-OPEN HARDENING comment in middleware.ts).
 * `isAdminOrService` below defers the `isAdmin` import to call time instead.
 *
 * Also no `node:crypto` here on purpose: `middleware.ts` runs on the Edge
 * Runtime by default (Next.js build warns "A Node.js module is loaded
 * ('crypto')... not supported in the Edge Runtime" the moment this file
 * imports it there), so the constant-time compare below is hand-rolled with
 * Web-standard `TextEncoder`, which works in both the Edge middleware and
 * the Node.js route handlers.
 */

/** Constant-time compare; any length mismatch is `false`, never a throw. */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

/**
 * True when the request carries a valid `X-Flocci-Service-Key` header
 * matching `OFFICIAL_ADMIN_SERVICE_KEY`. If that env var is unset/empty this
 * ALWAYS returns false — a missing key must never mean "allow".
 */
export function isServiceCall(req: NextRequest): boolean {
  const expected = process.env.OFFICIAL_ADMIN_SERVICE_KEY;
  if (!expected) return false;

  const provided = req.headers.get('x-flocci-service-key');
  if (!provided) return false;

  return constantTimeEquals(provided, expected);
}

/** Service call OR an authenticated human admin session. */
export async function isAdminOrService(req: NextRequest): Promise<boolean> {
  if (isServiceCall(req)) return true;
  const { isAdmin } = await import('./admin');
  return isAdmin(req);
}
