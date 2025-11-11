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
    const url = new URL(req.url);
    const { searchParams } = url;
    let code = searchParams.get('code');
    const error = searchParams.get('error');

    // If code not in query, check hash
    if (!code && url.hash) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      code = hashParams.get('code');
    }

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
        console.log("Processing profile for user:", data.user.id, data.user.email);
        
        // Always try to create/update profile for Google OAuth users
        const profileData = {
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name || 
                    data.user.user_metadata?.name || 
                    data.user.email?.split('@')[0] || 'User',
          email: data.user.email,
          phone: data.user.user_metadata?.phone || null,
          company_name: null,
          role: 'user',
          updated_at: new Date().toISOString()
        };

        // Use upsert to either insert new or update existing profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert(profileData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (profileError) {
          console.error("Profile upsert error:", profileError);
          
          // Fallback: try just insert if upsert fails
          const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .insert(profileData);
            
          if (insertError && !insertError.message.includes('duplicate')) {
            console.error("Profile insert fallback error:", insertError);
          } else {
            console.log("Profile created via fallback insert for user:", data.user.id);
          }
        } else {
          console.log("Profile upserted successfully for user:", data.user.id);
        }
      } catch (profileErr) {
        console.error("Profile processing error:", profileErr);
        
        // Last resort: simple insert with minimal data
        try {
          await supabaseAdmin
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: data.user.user_metadata?.name || 'User',
              email: data.user.email,
              role: 'user'
            });
          console.log("Profile created with minimal data for user:", data.user.id);
        } catch (finalErr) {
          console.error("Final profile creation attempt failed:", finalErr);
        }
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
