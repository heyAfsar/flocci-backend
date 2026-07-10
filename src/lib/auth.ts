import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * EDGE-SAFE auth utilities. This module is dynamically imported by the Vercel
 * Edge middleware (withAuth), where Node's 'crypto' module and module-top
 * Supabase construction both crash at invocation time — that combination is
 * what took the whole API down with MIDDLEWARE_INVOCATION_FAILED. Everything
 * here uses Web Crypto and lazy construction.
 */

const identityMode = () => (process.env.DB_TARGET || '').toLowerCase() === 'vps' || process.env.FLOCCI_IDENTITY === 'on';

// ── Web Crypto helpers ──────────────────────────────────────────────────────
const encoder = new TextEncoder();

async function digestHex(algorithm: 'SHA-256' | 'SHA-512', input: string): Promise<string> {
  const buf = await crypto.subtle.digest(algorithm, encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let pepperCache: string | null = null;
function pepper(): string {
  if (!pepperCache) pepperCache = process.env.PASSWORD_PEPPER || randomHex(32);
  return pepperCache;
}

// ── Legacy password + session primitives (Supabase target) ─────────────────
let adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase env not configured');
    adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return adminClient;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  const hash = await digestHex('SHA-512', password + salt + pepper());
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  const newHash = await digestHex('SHA-512', password + salt + pepper());
  return newHash === hash;
}

export function generateToken(): string {
  return randomHex(32);
}

export async function hashToken(token: string): Promise<string> {
  return digestHex('SHA-256', token);
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const { error } = await getAdmin().from('sessions').insert({
    user_id: userId,
    token: await hashToken(token),
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return token;
}

// ── Session verification (used by the edge middleware) ─────────────────────
// Identity mode verifies the Flocci identity JWT via JWKS — pure jose, fully
// edge-compatible, no database round-trip. Legacy mode checks the sessions
// table.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    const gateway = (process.env.FLOCCI_GATEWAY_URL || 'https://gateway.flocci.in').replace(/\/$/, '');
    jwks = createRemoteJWKSet(new URL(`${gateway}/api/identity/.well-known/jwks.json`));
  }
  return jwks;
}

export async function verifySession(token: string): Promise<boolean> {
  if (identityMode()) {
    try {
      await jwtVerify(token, getJwks(), {
        issuer: process.env.IDENTITY_ISSUER || 'https://id.flocci.in',
        audience: 'flocci',
      });
      return true;
    } catch {
      return false;
    }
  }
  const hashedToken = await hashToken(token);
  const { data: session } = await getAdmin()
    .from('sessions')
    .select('*')
    .eq('token', hashedToken)
    .gt('expires_at', new Date().toISOString())
    .single();
  return !!session;
}

// Extract session token from either cookies or Authorization header
export function extractSessionToken(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map((cookie) => {
        const [name, value] = cookie.split('=');
        return [name, decodeURIComponent(value)];
      }),
    );
    if (cookies.session_token) return cookies.session_token;
    if (cookies.flocci_token) return cookies.flocci_token;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}
