import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  APP_ID,
  identityEnabled,
  identityFetch,
  verifyIdentityToken,
  ensureProfile,
  applySetCookies,
  setAppSessionCookie,
} from '@/lib/identity';

export async function GET(req: NextRequest) {
  const frontendUrl = (process.env.FRONTEND_URL || 'https://flocci.in').replace(/\/$/, '');
  try {
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const { searchParams } = new URL(req.url);
    const error = searchParams.get('error');
    if (error) {
      return NextResponse.redirect(`${frontendUrl}/login?error=${error}`);
    }

    if (identityEnabled()) {
      // Identity-mediated Google flow: exchange the one-time handoff code for
      // a session. Identity emits both param dialects — accept either.
      const code = searchParams.get('code') || searchParams.get('handoffCode');
      const returnToRaw = searchParams.get('return_to') || searchParams.get('returnTo') || '/dashboard';
      const returnTo = returnToRaw.startsWith('/') ? returnToRaw : '/dashboard';
      if (!code) {
        return NextResponse.redirect(`${frontendUrl}/login?error=no_code`);
      }
      const result = await identityFetch('/v1/auth/google/session', {
        body: { code, app_id: APP_ID },
        cookieHeader: req.headers.get('cookie'),
      });
      if (result.status !== 200 || !result.body) {
        return NextResponse.redirect(`${frontendUrl}/login?error=exchange_failed`);
      }
      const accessToken =
        (result.body.access_token as string) ||
        ((result.body.session as Record<string, unknown>)?.['access_token'] as string);
      if (!accessToken) {
        return NextResponse.redirect(`${frontendUrl}/login?error=exchange_failed`);
      }
      const claims = await verifyIdentityToken(accessToken);
      await ensureProfile(claims);

      const target = returnTo === '/' ? '/dashboard' : returnTo;
      const response = NextResponse.redirect(`${frontendUrl}${target}`);
      applySetCookies(response, result.setCookies);
      setAppSessionCookie(response, accessToken);
      return response;
    }

    // ── Legacy path: Supabase code exchange + profile upsert ──
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(`${frontendUrl}/login?error=no_code`);
    }
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(`${frontendUrl}/login?error=exchange_failed`);
    }

    if (data.user) {
      try {
        const profileData = {
          id: data.user.id,
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0] ||
            'User',
          email: data.user.email,
          phone: data.user.user_metadata?.phone || null,
          company_name: null,
          role: 'user',
          updated_at: new Date().toISOString(),
        };
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert(profileData, { onConflict: 'id', ignoreDuplicates: false })
          .select()
          .single();
        if (profileError) {
          const { error: insertError } = await supabaseAdmin.from('profiles').insert(profileData);
          if (insertError && !insertError.message.includes('duplicate')) {
            console.error('Profile insert fallback error:', insertError);
          }
        }
      } catch (profileErr) {
        console.error('Profile processing error:', profileErr);
      }
    }

    const response = NextResponse.redirect(`${frontendUrl}/dashboard`);
    if (data.session) {
      response.cookies.set('supabase_session', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: cookieDomain,
        maxAge: data.session.expires_in || 3600,
      });
    }
    return response;
  } catch (e) {
    console.error('Auth callback error:', e);
    return NextResponse.redirect(`${frontendUrl}/login?error=callback_failed`);
  }
}
