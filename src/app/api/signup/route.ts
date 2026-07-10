import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import {
  APP_ID,
  identityEnabled,
  identityFetch,
  verifyIdentityToken,
  ensureProfile,
  applySetCookies,
  setAppSessionCookie,
} from '@/lib/identity';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  full_name: z.string().min(1, 'Full name is required').optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = signupSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: parseResult.error.flatten() }, { status: 400 });
    }
    const { email, password, full_name } = parseResult.data;

    if (identityEnabled()) {
      // One Flocci account for the whole suite — register with identity.
      const cookieHeader = req.headers.get('cookie');
      const reg = await identityFetch('/v1/auth/register', {
        body: { app_id: APP_ID, email, password, full_name: full_name || 'User', name: full_name || 'User' },
        cookieHeader,
      });
      if (reg.status === 409 || (reg.status === 400 && /exist/i.test(String(reg.body?.error || '')))) {
        return NextResponse.json({ error: 'User already exists' }, { status: 400 });
      }
      if (reg.status >= 400) {
        return NextResponse.json(
          { error: 'Failed to create user', details: String(reg.body?.error || `identity ${reg.status}`) },
          { status: 500 },
        );
      }
      // Register may or may not auto-issue a session — log in if it didn't.
      let accessToken =
        (reg.body?.access_token as string) ||
        ((reg.body?.session as Record<string, unknown>)?.['access_token'] as string) ||
        null;
      let setCookies = reg.setCookies;
      if (!accessToken) {
        const login = await identityFetch('/v1/auth/login', {
          body: { app_id: APP_ID, email, password },
          cookieHeader,
        });
        accessToken =
          (login.body?.access_token as string) ||
          ((login.body?.session as Record<string, unknown>)?.['access_token'] as string) ||
          null;
        setCookies = login.setCookies;
      }

      let user: { id: string; email: string; full_name: string | null } = {
        id: '',
        email,
        full_name: full_name || 'User',
      };
      if (accessToken) {
        const claims = await verifyIdentityToken(accessToken);
        const profile = await ensureProfile(claims);
        user = { id: profile.id, email: profile.email, full_name: profile.full_name };
      }
      const response = NextResponse.json({ message: 'Signup successful', user }, { status: 201 });
      if (accessToken) {
        applySetCookies(response, setCookies);
        setAppSessionCookie(response, accessToken);
      }
      return response;
    }

    // ── Legacy path (DB_TARGET=supabase): custom_users + profiles ──
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: existingUser } = await supabaseAdmin
      .from('custom_users')
      .select('id')
      .eq('email', email)
      .single();
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }
    const hashedPassword = await hashPassword(password);
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('custom_users')
      .insert([{ email, password_hash: hashedPassword, full_name: full_name || 'User', role: 'user', is_verified: false }])
      .select()
      .single();
    if (insertError) {
      return NextResponse.json({ error: 'Failed to create user', details: insertError.message }, { status: 500 });
    }
    await supabaseAdmin
      .from('profiles')
      .insert([{ user_id: newUser.id, email: newUser.email, full_name: newUser.full_name }]);
    return NextResponse.json(
      { message: 'Signup successful', user: { id: newUser.id, email: newUser.email, full_name: newUser.full_name } },
      { status: 201 },
    );
  } catch (e) {
    console.error('Signup error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
