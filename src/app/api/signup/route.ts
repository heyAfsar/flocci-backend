import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth';

// Use service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  full_name: z.string().min(1, "Full name is required").optional(),
});

export async function POST(req: NextRequest) {
  console.log("=== SIGNUP API CALLED ===");
  try {
    const body = await req.json();
    const parseResult = signupSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid input", details: parseResult.error.flatten() }, { status: 400 });
    }

    const { email, password, full_name } = parseResult.data;

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('custom_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Insert user into custom_users table
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('custom_users')
      .insert([{
        email,
        password_hash: hashedPassword,
        full_name: full_name || 'User',
        role: 'user',
        is_verified: false
      }])
      .select()
      .single();

    if (insertError) {
      console.log("Insert error:", insertError);
      return NextResponse.json({ error: "Failed to create user", details: insertError.message }, { status: 500 });
    }

    // Create profile entry
    await supabaseAdmin
      .from('profiles')
      .insert([{
        user_id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name
      }]);

    console.log("✅ Database signup successful");
    return NextResponse.json({ 
      message: "Signup successful", 
      user: { 
        id: newUser.id, 
        email: newUser.email,
        full_name: newUser.full_name 
      } 
    }, { status: 201 });

  } catch (e) {
    console.error("Signup error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}
