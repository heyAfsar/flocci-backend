import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { identityEnabled, resolveSession, applySetCookies } from '@/lib/identity';

/** Shape the combined profile response (contract unchanged). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFullProfile(id: string, email: string | null, profile: any, fallbackAvatar?: string | null) {
  return {
    id,
    email,
    name: profile.full_name || 'User',
    avatar_url: profile.avatar_url || fallbackAvatar || null,
    role: profile.role || 'user',
    phone: profile.phone,
    company_name: profile.company_name,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (identityEnabled()) {
      const session = await resolveSession(req);
      if (!session) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const response = NextResponse.json(
        toFullProfile(session.user.id, session.user.email, session.user),
        { status: 200 },
      );
      applySetCookies(response, session.setCookies);
      return response;
    }

    // ── Legacy path: Supabase auth token in the Authorization header ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      const newProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        email: user.email,
        phone: user.user_metadata?.phone || null,
        company_name: null,
        role: 'user',
        updated_at: new Date().toISOString(),
      };
      const { data: createdProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();
      if (createError) {
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }
      return NextResponse.json(
        toFullProfile(user.id, user.email ?? null, createdProfile, user.user_metadata?.avatar_url || user.user_metadata?.picture),
        { status: 200 },
      );
    }

    return NextResponse.json(
      toFullProfile(user.id, user.email ?? null, profile, user.user_metadata?.avatar_url || user.user_metadata?.picture),
      { status: 200 },
    );
  } catch (e) {
    console.error('Profile API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, phone, company_name } = body;
    const updates = { full_name, phone, company_name, updated_at: new Date().toISOString() };

    if (identityEnabled()) {
      const session = await resolveSession(req);
      if (!session) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id)
        .select()
        .single();
      if (updateError) {
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }
      const response = NextResponse.json(
        { message: 'Profile updated successfully', profile: updatedProfile },
        { status: 200 },
      );
      applySetCookies(response, session.setCookies);
      return response;
    }

    // ── Legacy path ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Profile updated successfully', profile: updatedProfile }, { status: 200 });
  } catch (e) {
    console.error('Profile update API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
