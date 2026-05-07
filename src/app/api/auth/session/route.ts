import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { extractSessionToken, hashToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  console.log('=== SESSION CHECK API CALLED ===');
  try {
    const trustedService = isTrustedServiceRequest(req);
    const cookieToken = getCookieSessionToken(req);
    const extractedToken = extractSessionToken(req);
    const sessionToken = cookieToken || (trustedService ? extractedToken : null);

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session token provided' }, { status: 401 });
    }

    // First, try validating against the custom session store.
    const hashedToken = await hashToken(sessionToken);

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select(`
        *,
        custom_users(id, email, full_name, role)
      `)
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
        { status: 200 }
      );
    }

    // Fallback for Google OAuth session token from Supabase auth.
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
      { status: 200 }
    );
  } catch (e) {
    console.error('Session check error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  console.log('=== LOGOUT API CALLED ===');
  try {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const sessionToken = req.cookies.get('session_token')?.value;

    if (sessionToken) {
      const hashedToken = await hashToken(sessionToken);

      await supabaseAdmin
        .from('sessions')
        .delete()
        .eq('token', hashedToken);
    }

    const response = NextResponse.json({ message: 'Logout successful' }, { status: 200 });
    response.cookies.set('session_token', '', { maxAge: 0, path: '/', domain: cookieDomain });
    response.cookies.set('supabase_session', '', { maxAge: 0, path: '/', domain: cookieDomain });

    return response;
  } catch (e) {
    console.error('Logout error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
