import { NextRequest, NextResponse } from 'next/server';
import { identityEnabled, identityFetch, applySetCookies, clearAppSessionCookie } from '@/lib/identity';

/**
 * Umbrella logout: revoke the platform identity session and forward its
 * clearing Set-Cookie headers — sign-out anywhere = signed out everywhere.
 */
export async function POST(req: NextRequest) {
  if (!identityEnabled()) {
    return NextResponse.json({ error: 'SSO logout unavailable' }, { status: 404 });
  }
  try {
    const result = await identityFetch('/v1/auth/logout', { cookieHeader: req.headers.get('cookie') });
    const response = NextResponse.json({ message: 'Logged out everywhere' }, { status: 200 });
    applySetCookies(response, result.setCookies);
    clearAppSessionCookie(response);
    return response;
  } catch (e) {
    console.error('Umbrella logout error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
