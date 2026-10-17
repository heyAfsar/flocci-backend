/**
 * Server-to-server client for the Talent Suite Careers Portal API.
 * Contract: flocci-talent-suite-srv/docs/CAREERS_PORTAL_API.md
 *
 * The key never leaves the server. Callers must pass the verified session
 * email, never an email taken from the browser.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies } from '@/lib/identity';

const DEFAULT_BASE = 'https://talent.flocci.in/api/portal/v1';
const TIMEOUT_MS = 15_000;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const portalBase = () => (process.env.TALENT_PORTAL_API_URL || DEFAULT_BASE).replace(/\/+$/, '');
export const portalConfigured = () => Boolean(process.env.TALENT_PORTAL_KEY);

export class PortalError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PortalError';
    this.status = status;
  }
}

/** Talent statuses we pass through; anything else collapses to a generic 502. */
function cleanStatus(status: number): number {
  if ([400, 404, 413, 422, 429].includes(status)) return status;
  return 502;
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 400: return 'That action is not available right now.';
    case 404: return 'We could not find that challenge.';
    case 413: return 'That file is too large.';
    case 422: return 'Some required fields are missing.';
    case 429: return 'Too many requests. Wait a moment and try again.';
    default: return 'The challenge service is unavailable. Please try again shortly.';
  }
}

async function portalFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.TALENT_PORTAL_KEY;
  if (!key) throw new PortalError('Challenges are not available right now.', 503);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${portalBase()}${path}`, {
      ...init,
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { ...((init.headers as Record<string, string>) || {}), 'X-Talent-Portal-Key': key },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new PortalError(
      aborted ? 'The challenge service took too long to respond. Please try again.' : 'The challenge service is unavailable. Please try again shortly.',
      504
    );
  } finally {
    clearTimeout(timer);
  }
}

async function failFrom(res: Response): Promise<never> {
  let msg = '';
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string') msg = body.error;
  } catch {
    /* non-JSON */
  }
  if (res.status === 401) {
    // Our key is wrong: a server configuration problem, not the candidate's.
    console.error('Talent portal rejected TALENT_PORTAL_KEY (401)');
    throw new PortalError('The challenge service is unavailable. Please try again shortly.', 502);
  }
  const status = cleanStatus(res.status);
  throw new PortalError(msg && status !== 502 ? msg : fallbackMessage(status), status);
}

export async function portalJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(path, init);
  if (!res.ok) await failFrom(res);
  return (await res.json()) as T;
}

/** Streamed file download; returns the upstream Response for the caller to relay. */
export async function portalRaw(path: string): Promise<Response> {
  const res = await portalFetch(path);
  if (!res.ok) await failFrom(res);
  return res;
}

export const portalPostJson = <T>(path: string, body: Record<string, unknown>) =>
  portalJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Shared auth wrapper: 401 without a session, 503 when unconfigured, mapped errors. */
export async function withCandidate(
  req: NextRequest,
  handler: (email: string) => Promise<NextResponse | Response>,
  opts: { requireKey?: boolean } = { requireKey: true }
): Promise<NextResponse | Response> {
  try {
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 });
    const email = String(session.user.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 });

    if (opts.requireKey !== false && !portalConfigured()) {
      return NextResponse.json({ error: 'Challenges are not available right now.' }, { status: 503 });
    }

    const out = await handler(email);
    if (out instanceof NextResponse) applySetCookies(out, session.setCookies);
    return out;
  } catch (e) {
    if (e instanceof PortalError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('Careers challenge error:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export function readSubmission(body: unknown): Record<string, unknown> {
  const sub = (body as { submission?: unknown })?.submission;
  return sub && typeof sub === 'object' && !Array.isArray(sub) ? (sub as Record<string, unknown>) : {};
}
