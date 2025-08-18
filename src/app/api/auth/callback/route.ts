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
  console.log("Request URL:", req.url);
  console.log("Request headers host:", req.headers.get('host'));
  
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Frontend URL for redirects
    const frontendUrl = process.env.FRONTEND_URL || 'https://flocci.in';

    console.log("Code:", code);
    console.log("Error:", error);

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(`${frontendUrl}/login?error=${error}`);
    }

    if (!code) {
      console.error("No code provided");
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
          avatar_url: data.user.user_metadata?.avatar_url || 
                     data.user.user_metadata?.picture || null,
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
      }
    }

    // Create session token and redirect with it
    const sessionToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;
    
    // Redirect to dashboard with session info as URL params (temporarily)
    const redirectUrl = `${frontendUrl}/dashboard?session=${encodeURIComponent(sessionToken || '')}&refresh=${encodeURIComponent(refreshToken || '')}&user_id=${data.user?.id || ''}`;
    
    return NextResponse.redirect(redirectUrl);

  } catch (e) {
    console.error("Auth callback error:", e);
    const frontendUrl = process.env.FRONTEND_URL || 'https://flocci.in';
    return NextResponse.redirect(`${frontendUrl}/login?error=callback_failed`);
  }
}
