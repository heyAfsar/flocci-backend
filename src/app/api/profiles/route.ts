import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Admin client for profile operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  console.log("=== GET PROFILE API CALLED ===");
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Fetch profile from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.log("Profile not found, creating one for user:", user.id);
      
      // Create profile if it doesn't exist
      const newProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        phone: user.user_metadata?.phone || null,
        company_name: null,
        role: 'user',
        updated_at: new Date().toISOString()
      };

      const { data: createdProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        console.error("Failed to create profile:", createError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }

      // Return the newly created profile
      const fullProfile = {
        id: user.id,
        email: user.email,
        name: createdProfile.full_name,
        avatar_url: createdProfile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
        role: createdProfile.role,
        phone: createdProfile.phone,
        company_name: createdProfile.company_name,
        created_at: createdProfile.created_at,
        updated_at: createdProfile.updated_at
      };

      return NextResponse.json(fullProfile, { status: 200 });
    }

    // Combine auth user data with profile data
    const fullProfile = {
      id: user.id,
      email: user.email,
      name: profile.full_name || user.user_metadata?.name || 'User',
      avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
      role: profile.role || 'user',
      phone: profile.phone,
      company_name: profile.company_name,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    };

    return NextResponse.json(fullProfile, { status: 200 });

  } catch (e) {
    console.error("Profile API error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  console.log("=== UPDATE PROFILE API CALLED ===");
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { full_name, phone, company_name, avatar_url } = body;

    // Update profile in profiles table
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        phone,
        company_name,
        avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      profile: updatedProfile
    }, { status: 200 });

  } catch (e) {
    console.error("Profile update API error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}
