import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { extractSessionToken, hashToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  identityEnabled,
  identityFetch,
  resolveSession,
  applySetCookies,
  setAppSessionCookie,
  clearAppSessionCookie,
} from '@/lib/identity';

function isTrustedServiceRequest(req: NextRequest): boolean {
  const provided = req.headers.get('x-flocci-service-token');
  const expected = process.env.WORK_APPS_SERVICE_TOKEN;
  if (!provided || !expected) return false;
  return provided === expected;
}

function getCookieSessionToken(req: NextRequest): string | null {
  return req.cookies.get('session_token')?.value || req.cookies.get('supabase_session')?.value || null;
}

export async function GET(req: NextRequest) {
  try {
    if (identityEnabled()) {
      // The cross-app SSO engine: a valid token from ANY Flocci app — or just
      // the platform refresh cookie — authenticates here silently. Rotated
      // cookies are forwarded so the umbrella session never strands.
      const session = await resolveSession(req);
      if (!session) {
        return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
      }
      const response = NextResponse.json(
        {
          message: 'Session valid',
          provider: 'flocci_identity',
          user: {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.full_name,
            role: session.user.role,
            avatar_url: session.user.avatar_url,
          },
          expires_at: session.claims.exp ? new Date(session.claims.exp * 1000).toISOString() : null,
        },
        { status: 200 },
      );
      if (session.setCookies.length) {
        applySetCookies(response, session.setCookies);
        // keep the app cookie in step with the rotated platform token
        const rotated = session.setCookies.find((c) => c.startsWith('flocci_token='));
        const newToken = rotated?.split(';')[0].split('=').slice(1).join('=');
        if (newToken) setAppSessionCookie(response, newToken);
      }
      return response;
    }

    // ── Legacy path: custom sessions table, then Supabase OAuth token ──
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const trustedService = isTrustedServiceRequest(req);
    const cookieToken = getCookieSessionToken(req);
    const extractedToken = extractSessionToken(req);
    const sessionToken = cookieToken || (trustedService ? extractedToken : null);

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 401 });
    }

    const hashedToken = await hashToken(sessionToken);
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select(`*, custom_users(id, email, full_name, role)`)
      .eq('token', hashedToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!sessionError && session) {
      return NextResponse.json(
        {
          message: 'Session valid',
          user: session.custom_users,
          provider: 'custom_session',
          session_id: session.id,
          expires_at: session.expires_at,
        },
        { status: 200 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(sessionToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }
    return NextResponse.json(
      {
        message: 'Session valid',
        provider: 'supabase_oauth',
        user: {
          id: user.id,
          email: user.email,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'User',
          role: 'user',
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Session check error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

    if (identityEnabled()) {
      // Sign-out anywhere = signed out everywhere (founder decision): revoke
      // the identity session and forward its clearing Set-Cookie headers.
      const result = await identityFetch('/v1/auth/logout', {
        cookieHeader: req.headers.get('cookie'),
      });
      const response = NextResponse.json({ message: 'Logout successful' }, { status: 200 });
      applySetCookies(response, result.setCookies);
      clearAppSessionCookie(response);
      // raw append — cookies.set() would clobber the forwarded identity cookies
      response.headers.append(
        'set-cookie',
        `supabase_session=; Path=/; Max-Age=0${cookieDomain ? `; Domain=${cookieDomain}` : ''}`,
      );
      return response;
    }

    // ── Legacy path ──
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const sessionToken = req.cookies.get('session_token')?.value;
    if (sessionToken) {
      const hashedToken = await hashToken(sessionToken);
      await supabaseAdmin.from('sessions').delete().eq('token', hashedToken);
    }
    const response = NextResponse.json({ message: 'Logout successful' }, { status: 200 });
    response.cookies.set('session_token', '', { maxAge: 0, path: '/', domain: cookieDomain });
    response.cookies.set('supabase_session', '', { maxAge: 0, path: '/', domain: cookieDomain });
    return response;
  } catch (e) {
    console.error('Logout error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
