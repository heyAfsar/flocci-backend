import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword, createSession } from '@/lib/auth';

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  console.log("=== LOGIN API CALLED ===");
  try {
    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid input", details: parseResult.error.flatten() }, { status: 400 });
    }

    const { email, password } = parseResult.data;

    // Find user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from('custom_users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Create session
    const sessionToken = await createSession(user.id);

    // Return user data and session token
    const response = NextResponse.json({ 
      message: "Login successful", 
      user: { 
        id: user.id, 
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      session_token: sessionToken
    }, { status: 200 });

    // Set session cookie
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    console.log("✅ Login successful for:", email);
    return response;

  } catch (e) {
    console.error("Login error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}
