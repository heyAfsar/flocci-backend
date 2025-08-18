import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Admin client for profile operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  console.log("=== AUTH CALLBACK CALLED ===");
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=no_code`);
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=exchange_failed`);
    }

    // Ensure profile exists for the user
    if (data.user) {
      try {
        // Check if profile exists
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        // If no profile exists, create one
        if (!profile) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: data.user.user_metadata?.full_name || 
                        data.user.user_metadata?.name || 
                        data.user.email?.split('@')[0] || 'User',
              role: 'user'
            });

          if (profileError) {
            console.error("Profile creation error:", profileError);
            // Don't fail the login, just log the error
          }
        }
      } catch (profileErr) {
        console.error("Profile check/creation error:", profileErr);
        // Don't fail the login
      }
    }

    // Successful OAuth login - redirect to success page or dashboard
    const response = NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/dashboard?login=success`);
    
    // Set session cookie
    if (data.session) {
      response.cookies.set('supabase_session', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in || 3600
      });
    }

    return response;

  } catch (e) {
    console.error("Auth callback error:", e);
    return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=callback_failed`);
  }
}
