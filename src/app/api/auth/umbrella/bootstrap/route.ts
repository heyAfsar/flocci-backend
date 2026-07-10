import { NextRequest, NextResponse } from 'next/server';
import { identityEnabled, resolveSession, applySetCookies, setAppSessionCookie } from '@/lib/identity';

/**
 * Cross-app SSO bootstrap (KB roadmaps/72): no usable app session but the
 * platform cookies (flocci_token/flocci_refresh, Domain=.flocci.in) are
 * present → mint this app's session silently and forward rotated cookies.
 * 401 when there is no platform session — the UI then shows signed-out state.
 */
export async function POST(req: NextRequest) {
  if (!identityEnabled()) {
    return NextResponse.json({ error: 'SSO bootstrap unavailable' }, { status: 404 });
  }
  try {
    const session = await resolveSession(req);
    if (!session) {
      return NextResponse.json({ error: 'No platform session' }, { status: 401 });
    }
    const response = NextResponse.json(
      {
        message: 'Session bootstrapped',
        user: {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.full_name,
          role: session.user.role,
          avatar_url: session.user.avatar_url,
        },
      },
      { status: 200 },
    );
    applySetCookies(response, session.setCookies);
    const rotated = session.setCookies.find((c) => c.startsWith('flocci_token='));
    const token = rotated ? rotated.split(';')[0].split('=').slice(1).join('=') : null;
    if (token) setAppSessionCookie(response, token);
    return response;
  } catch (e) {
    console.error('Umbrella bootstrap error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
