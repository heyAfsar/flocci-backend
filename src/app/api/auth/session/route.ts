import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { hashToken } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  console.log("=== SESSION CHECK API CALLED ===");
  try {
    const sessionToken = req.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: "No session token provided" }, { status: 401 });
    }

    // Hash the token to compare with stored hash
    const hashedToken = await hashToken(sessionToken);

    // Find session in database
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select(`
        *,
        custom_users(id, email, full_name, role)
      `)
      .eq('token', hashedToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    return NextResponse.json({ 
      message: "Session valid", 
      user: session.custom_users,
      session_id: session.id,
      expires_at: session.expires_at
    }, { status: 200 });

  } catch (e) {
    console.error("Session check error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  console.log("=== LOGOUT API CALLED ===");
  try {
    const sessionToken = req.cookies.get('session_token')?.value;
    
    if (sessionToken) {
      // Hash the token to find and delete session
      const hashedToken = await hashToken(sessionToken);
      
      await supabaseAdmin
        .from('sessions')
        .delete()
        .eq('token', hashedToken);
    }

    // Clear session cookie
    const response = NextResponse.json({ message: "Logout successful" }, { status: 200 });
    response.cookies.delete('session_token');
    response.cookies.delete('supabase_session');

    return response;

  } catch (e) {
    console.error("Logout error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: errorMessage
    }, { status: 500 });
  }
}
