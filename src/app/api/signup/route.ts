import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  // You can add more fields here, e.g., name, and pass them to options.data in signUp
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = signupSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid input", details: parseResult.error.flatten() }, { status: 400 });
    }

    const { email, password } = parseResult.data;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // options: {
      //   data: { full_name: 'Optional Name' } // Example of passing additional data
      // }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
       // This case might indicate that email confirmation is required and the user is not yet active.
       // Supabase default is email confirmation ON.
      return NextResponse.json({ message: "Signup successful, please check your email for confirmation." }, { status: 201 });
    }
    
    // If user is immediately active (e.g. email confirmation disabled on Supabase)
    return NextResponse.json({ message: "Signup successful", user: data.user }, { status: 201 });

  } catch (e) {
    console.error("Signup error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ error: "Internal Server Error", details: errorMessage }, { status: 500 });
  }
}
