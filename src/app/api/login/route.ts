import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword, createSession } from '@/lib/auth';
import {
  APP_ID,
  identityEnabled,
  identityFetch,
  verifyIdentityToken,
  ensureProfile,
  applySetCookies,
  setAppSessionCookie,
} from '@/lib/identity';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: parseResult.error.flatten() }, { status: 400 });
    }
    const { email, password } = parseResult.data;

    if (identityEnabled()) {
      // Sign in against the shared Flocci identity service — one account for
      // every Flocci app. Browser cookies ride along both ways so the
      // platform SSO pair (flocci_token/flocci_refresh) stays in lock-step.
      const result = await identityFetch('/v1/auth/login', {
        body: { app_id: APP_ID, email, password },
        cookieHeader: req.headers.get('cookie'),
      });
      if (result.status !== 200 || !result.body) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
      const accessToken =
        (result.body.access_token as string) ||
        ((result.body.session as Record<string, unknown>)?.['access_token'] as string);
      if (!accessToken) {
        return NextResponse.json({ error: 'Identity service returned no token' }, { status: 502 });
      }
      const claims = await verifyIdentityToken(accessToken);
      const profile = await ensureProfile(claims);

      const response = NextResponse.json(
        {
          message: 'Login successful',
          user: { id: profile.id, email: profile.email, full_name: profile.full_name, role: profile.role },
          session_token: accessToken,
        },
        { status: 200 },
      );
      applySetCookies(response, result.setCookies);
      setAppSessionCookie(response, accessToken);
      return response;
    }

    // ── Legacy path (DB_TARGET=supabase): custom_users + sessions table ──
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const { data: user, error: userError } = await supabaseAdmin
      .from('custom_users')
      .select('*')
      .eq('email', email)
      .single();
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    const sessionToken = await createSession(user.id);
    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
        session_token: sessionToken,
      },
      { status: 200 },
    );
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (e) {
    console.error('Login error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
