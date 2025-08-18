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

    // Frontend URL for redirects
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(`${frontendUrl}/login?error=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${frontendUrl}/login?error=no_code`);
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      return NextResponse.redirect(`${frontendUrl}/login?error=exchange_failed`);
    }

    // Ensure profile exists for the user
    if (data.user) {
      try {
        console.log("Creating/updating profile for user:", data.user.id);
        
        // Check if profile exists
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        // If no profile exists, create one
        if (!profile) {
          const profileData = {
            id: data.user.id,
            full_name: data.user.user_metadata?.full_name || 
                      data.user.user_metadata?.name || 
                      data.user.email?.split('@')[0] || 'User',
            email: data.user.email,
            avatar_url: data.user.user_metadata?.avatar_url || 
                       data.user.user_metadata?.picture,
            role: 'user'
          };

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert(profileData);

          if (profileError) {
            console.error("Profile creation error:", profileError);
            // Don't fail the login, just log the error
          } else {
            console.log("Profile created successfully for user:", data.user.id);
          }
        } else {
          console.log("Profile already exists for user:", data.user.id);
        }
      } catch (profileErr) {
        console.error("Profile check/creation error:", profileErr);
        // Don't fail the login
      }
    }

    // Successful OAuth login - redirect to clean dashboard URL
    const response = NextResponse.redirect(`${frontendUrl}/dashboard`);
    
    // Set session cookie for additional security
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
    return NextResponse.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8081'}/login?error=callback_failed`);
  }
}
