import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { createSession } from '@/lib/auth';

// Admin client for user operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Google OAuth2 client for ID token verification
const GOOGLE_CLIENT_ID = '547138038457-vfv8e8cqkqd19rjqd7ebtlgbfslqmlgm.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  console.log("=== GOOGLE LOGIN API CALLED ===");
  try {
    const body = await req.json();
    const { credential } = body;

    // NEW FLOW: Google One Tap ID Token Verification
    if (credential) {
      console.log("=== Processing Google One Tap ID Token ===");
      try {
        // Verify the ID token
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        if (!payload) {
          return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
        }

        const { sub: googleId, email, name, picture } = payload;
        
        if (!email) {
          return NextResponse.json({ error: 'Email not found in token' }, { status: 401 });
        }

        console.log("Token verified for:", email);

        // Check if user exists in custom_users table
        let { data: customUser, error: customUserError } = await supabaseAdmin
          .from('custom_users')
          .select('*')
          .eq('email', email)
          .single();

        // If no custom user exists, check in auth.users and create custom user
        if (!customUser) {
          console.log("Creating new user for:", email);
          
          // Check if user exists in Supabase auth.users
          const { data: { users }, error: authUserError } = await supabaseAdmin.auth.admin.listUsers();
          const existingAuthUser = users?.find(u => u.email === email);

          let userId: string;

          if (existingAuthUser) {
            userId = existingAuthUser.id;
            console.log("Found existing auth user:", userId);
          } else {
            // Create new auth user
            const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
              email,
              email_confirm: true,
              user_metadata: {
                full_name: name,
                avatar_url: picture,
                google_id: googleId
              }
            });

            if (createAuthError || !newAuthUser.user) {
              console.error("Failed to create auth user:", createAuthError);
              return NextResponse.json({ 
                error: 'Failed to create user account',
                details: createAuthError?.message 
              }, { status: 500 });
            }

            userId = newAuthUser.user.id;
            console.log("Created new auth user:", userId);
          }

          // Create custom user entry
          const { data: newCustomUser, error: createCustomError } = await supabaseAdmin
            .from('custom_users')
            .insert({
              id: userId,
              email,
              full_name: name || email.split('@')[0],
              role: 'user',
              password_hash: '' // Google OAuth users don't have passwords
            })
            .select()
            .single();

          if (createCustomError) {
            console.error("Failed to create custom user:", createCustomError);
            return NextResponse.json({ 
              error: 'Failed to create user profile',
              details: createCustomError.message 
            }, { status: 500 });
          }

          customUser = newCustomUser;
        }

        // Ensure profile exists
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: customUser.id,
            full_name: name || customUser.full_name,
            email,
            avatar_url: picture,
            role: 'user',
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (profileError) {
          console.warn("Profile upsert warning:", profileError);
          // Non-fatal, continue
        }

        // Create session
        const sessionToken = await createSession(customUser.id);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        console.log("✅ Google One Tap login successful for:", email);

        // Return user + session data
        return NextResponse.json({
          user: {
            id: customUser.id,
            email: customUser.email,
            name: customUser.full_name,
            role: customUser.role
          },
          session_token: sessionToken,
          expiresAt: expiresAt.toISOString()
        }, { status: 200 });

      } catch (error) {
        console.error("ID token verification error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Invalid Google credential';
        return NextResponse.json({ 
          error: 'Invalid Google credential',
          details: errorMessage
        }, { status: 401 });
      }
    }

    // EXISTING FLOW: OAuth Redirect (unchanged for backward compatibility)
    console.log("=== Processing OAuth Redirect Flow ===");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      message: "Redirect to Google OAuth", 
      url: data.url 
    }, { status: 200 });

  } catch (e) {
    console.error("Google login error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Handle redirect back from Google
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json({ error: "No authorization code provided" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Code exchange error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // User is now logged in via Google
    return NextResponse.json({ 
      message: "Google login successful", 
      user: data.user,
      session: data.session
    }, { status: 200 });

  } catch (e) {
    console.error("Google callback error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}
