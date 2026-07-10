import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken, extractSessionToken } from '@/lib/auth';
import { identityEnabled, resolveSession } from '@/lib/identity';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const sessionToken = extractSessionToken(req);

  if (!sessionToken && !identityEnabled()) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  let email: string | undefined;
  let error = null;
  let sessions: unknown[] | null = [null];
  if (identityEnabled()) {
    // Identity mode: the drive account signs in with its Flocci account.
    const session = await resolveSession(req);
    email = session?.user.email;
    if (!session) sessions = [];
  } else {
    const hashedToken = await hashToken(sessionToken!);
    const res = await supabaseAdmin
      .from('sessions')
      .select('custom_users(email)')
      .eq('token', hashedToken);
    sessions = res.data;
    error = res.error;
    const cu = res.data && res.data.length > 0 ? res.data[0].custom_users : undefined;
    if (cu) {
      email = Array.isArray(cu) ? cu[0]?.email : (cu as { email: string }).email;
    }
  }

  if (error || !sessions || sessions.length === 0 || !email || email !== 'placementdrive@amity.in') {
    return NextResponse.json({ error: 'Forbidden' }, { 
      status: 403,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const filePath = path.resolve('./src/app/api/amity/processing_v3.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  return NextResponse.json(JSON.parse(fileContent), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
