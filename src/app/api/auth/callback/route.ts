import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  console.log("=== AUTH CALLBACK CALLED ===");
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=no_code`);
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=exchange_failed`);
    }

    // Successful OAuth login - redirect to success page or dashboard
    const response = NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/dashboard?login=success`);
    
    // Set session cookie
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
    return NextResponse.redirect(`${process.env.APP_URL || 'http://localhost:3000'}?error=callback_failed`);
  }
}
