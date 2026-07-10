import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { APP_ID, IDENTITY_BASE, identityEnabled } from '@/lib/identity';

/**
 * POST — hand the UI the Google sign-in URL. Contract: `{ message, url }`.
 * With identity enabled the flow is auth-service-mediated: the ONLY Google
 * redirect URI is identity's own callback; identity hands the user back to
 * /api/auth/callback with a one-time code.
 */
export async function POST(req: NextRequest) {
  try {
    if (identityEnabled()) {
      let returnTo = '/';
      try {
        const body = await req.json();
        if (typeof body?.return_to === 'string' && body.return_to.startsWith('/')) returnTo = body.return_to;
      } catch {
        /* no body */
      }
      const appUrl = (process.env.APP_URL || 'https://apis.flocci.in').replace(/\/$/, '');
      const url = new URL(`${IDENTITY_BASE}/v1/auth/google/start`);
      url.searchParams.set('app_id', APP_ID);
      url.searchParams.set('frontend_redirect', `${appUrl}/api/auth/callback`);
      url.searchParams.set('return_to', returnTo);
      return NextResponse.json({ message: 'Redirect to Google OAuth', url: url.toString() }, { status: 200 });
    }

    // ── Legacy path: Supabase-hosted OAuth ──
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Redirect to Google OAuth', url: data.url }, { status: 200 });
  } catch (e) {
    console.error('Google login error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

/** GET — legacy direct-code handler (Supabase flow only). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }
  if (identityEnabled()) {
    // Identity-mediated flow lands on /api/auth/callback instead.
    return NextResponse.json({ error: 'Use /api/auth/callback for the identity flow' }, { status: 410 });
  }
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: 'Google login successful', user: data.user, session: data.session },
      { status: 200 },
    );
  } catch (e) {
    console.error('Google callback error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
