import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

/**
 * Flocci identity-service client (cross-app SSO — KB roadmaps/72).
 *
 * This app runs on Vercel, so identity is reached through the PUBLIC gateway
 * (`https://gateway.flocci.in/api/identity/...`, + X-Flocci-Service-Key when
 * staged). The platform cookies `flocci_token`/`flocci_refresh` are issued
 * with Domain=.flocci.in, so they arrive first-party on flocci.in and
 * apis.flocci.in — every session endpoint here forwards the browser's Cookie
 * header to identity and identity's Set-Cookie headers back, keeping the
 * shared session rotating in lock-step (skipping that breaks SSO
 * platform-wide, not just here).
 */

export const APP_ID = 'official-website';

const GATEWAY = (process.env.FLOCCI_GATEWAY_URL || 'https://gateway.flocci.in').replace(/\/$/, '');
export const IDENTITY_BASE = `${GATEWAY}/api/identity`;
const ISSUER = process.env.IDENTITY_ISSUER || 'https://id.flocci.in';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${IDENTITY_BASE}/.well-known/jwks.json`));
  return jwks;
}

export type IdentityClaims = JWTPayload & {
  sub: string;
  email?: string;
  name?: string;
  roles?: string[];
  avatar_url?: string;
  picture?: string;
};

export async function verifyIdentityToken(token: string): Promise<IdentityClaims> {
  const { payload } = await jwtVerify(token, getJwks(), { issuer: ISSUER, audience: 'flocci' });
  return payload as IdentityClaims;
}

export class IdentityError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export type IdentityResponse = { status: number; body: Record<string, unknown> | null; setCookies: string[] };

/** Server→identity call that carries the browser's cookies both ways. */
export async function identityFetch(
  path: string,
  opts: { method?: string; body?: unknown; cookieHeader?: string | null } = {},
): Promise<IdentityResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.FLOCCI_SERVICE_KEY) headers['X-Flocci-Service-Key'] = process.env.FLOCCI_SERVICE_KEY;
  if (opts.cookieHeader) headers['Cookie'] = opts.cookieHeader;
  const res = await fetch(`${IDENTITY_BASE}${path}`, {
    method: opts.method || 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
  });
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* no body */
  }
  return { status: res.status, body, setCookies: res.headers.getSetCookie() };
}

/** Forward identity's Set-Cookie headers to the browser response. */
export function applySetCookies(res: NextResponse, setCookies: string[]) {
  for (const sc of setCookies) res.headers.append('set-cookie', sc);
}

/** Extract the access token this app recognizes as a session. */
export function extractAccessToken(req: NextRequest): string | null {
  return (
    req.cookies.get('session_token')?.value ||
    req.cookies.get('flocci_token')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null
  );
}

export type AppUser = {
  id: string;
  identity_user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
};

/**
 * Resolve-or-provision the local profile row for identity claims.
 * Local `profiles.role` stays authoritative (admin/company are product-owned);
 * ADMIN_EMAILS keeps working via lib/admin.ts on top of this.
 */
export async function ensureProfile(claims: IdentityClaims): Promise<AppUser> {
  const email = String(claims.email || '').toLowerCase();
  const fullName = (claims.name as string) || email.split('@')[0] || 'Flocci User';
  const avatar = (claims.avatar_url as string) || (claims.picture as string) || null;

  const { data: byIdentity } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('identity_user_id', claims.sub)
    .single();
  if (byIdentity) return byIdentity as AppUser;

  if (email) {
    const { data: byEmail } = await supabaseAdmin.from('profiles').select('*').eq('email', email).single();
    if (byEmail) {
      const { data: linked } = await supabaseAdmin
        .from('profiles')
        .update({ identity_user_id: claims.sub, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id)
        .select()
        .single();
      return (linked || { ...byEmail, identity_user_id: claims.sub }) as AppUser;
    }
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('profiles')
    .insert([
      {
        identity_user_id: claims.sub,
        email: email || `${claims.sub}@users.flocci.in`,
        full_name: fullName,
        avatar_url: avatar,
        role: 'user',
      },
    ])
    .select()
    .single();
  if (error || !inserted) throw new Error(`profile provisioning failed: ${error?.message}`);
  return inserted as AppUser;
}

export type SessionResolution = {
  user: AppUser;
  claims: IdentityClaims;
  /** rotated platform cookies to forward, when a silent refresh happened */
  setCookies: string[];
};

/**
 * The SSO engine: resolve the current user from the request.
 * 1. Verify the access token (app cookie, platform cookie, or Bearer).
 * 2. If missing/expired but `flocci_refresh` is present (login happened in ANY
 *    Flocci app), silently refresh via identity and forward rotated cookies —
 *    this is the session carry-over.
 */
export async function resolveSession(req: NextRequest): Promise<SessionResolution | null> {
  const token = extractAccessToken(req);
  if (token) {
    try {
      const claims = await verifyIdentityToken(token);
      const user = await ensureProfile(claims);
      return { user, claims, setCookies: [] };
    } catch {
      /* expired/invalid — fall through to refresh */
    }
  }

  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader || !cookieHeader.includes('flocci_refresh')) return null;
  const refreshed = await identityFetch('/v1/auth/refresh', { cookieHeader });
  if (refreshed.status !== 200 || !refreshed.body) return null;
  const newToken =
    (refreshed.body.access_token as string) ||
    ((refreshed.body.session as Record<string, unknown>)?.['access_token'] as string) ||
    null;
  if (!newToken) return null;
  try {
    const claims = await verifyIdentityToken(newToken);
    const user = await ensureProfile(claims);
    return { user, claims, setCookies: refreshed.setCookies };
  } catch {
    return null;
  }
}

/**
 * Set this app's own session cookie (contract: `session_token`).
 * IMPORTANT: append a raw Set-Cookie header — NextResponse.cookies.set()
 * re-serializes the whole set-cookie header and silently clobbers identity's
 * forwarded flocci_* cookies (which would break cross-app SSO).
 */
export function setAppSessionCookie(res: NextResponse, accessToken: string, maxAgeSec = 7 * 24 * 3600) {
  const parts = [
    `session_token=${accessToken}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  if (process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  res.headers.append('set-cookie', parts.join('; '));
}

export function clearAppSessionCookie(res: NextResponse) {
  const parts = ['session_token=', 'Path=/', 'Max-Age=0'];
  if (process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  res.headers.append('set-cookie', parts.join('; '));
}

export const identityEnabled = () => (process.env.DB_TARGET || '').toLowerCase() === 'vps' || process.env.FLOCCI_IDENTITY === 'on';
