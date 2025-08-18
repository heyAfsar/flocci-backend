import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client for profile operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("=== FRAGMENT HANDLER CALLED ===");
  
  try {
    const { access_token, refresh_token, user_id } = await req.json();
    const frontendUrl = process.env.FRONTEND_URL || 'https://flocci.in';

    if (!access_token || !user_id) {
      console.error("Missing tokens or user_id");
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get user details using access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(access_token);
    
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Ensure profile exists for the user
    try {
      console.log("Processing profile for user:", user.id, user.email);
      
      // Always try to create/update profile for Google OAuth users
      const profileData = {
        id: user.id,
        full_name: user.user_metadata?.full_name || 
                  user.user_metadata?.name || 
                  user.email?.split('@')[0] || 'User',
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || 
                   user.user_metadata?.picture || null,
        phone: user.user_metadata?.phone || null,
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
          console.log("Profile created via fallback insert for user:", user.id);
        }
      } else {
        console.log("Profile upserted successfully for user:", user.id);
      }
    } catch (profileErr) {
      console.error("Profile processing error:", profileErr);
    }

    // Return success with redirect URL
    return NextResponse.json({ 
      success: true,
      redirect: `${frontendUrl}/dashboard`,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name
      }
    }, { status: 200 });

  } catch (e) {
    console.error("Fragment handler error:", e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
