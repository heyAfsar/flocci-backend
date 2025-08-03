import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken, extractSessionToken } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const sessionToken = extractSessionToken(req);

  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { 
      status: 401,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const hashedToken = await hashToken(sessionToken);
  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('custom_users(email)')
    .eq('token', hashedToken);

  let email;
  const cu = sessions && sessions.length > 0 ? sessions[0].custom_users : undefined;
  if (cu) {
    if (Array.isArray(cu)) {
      email = cu[0]?.email;
    } else {
      email = (cu as { email: string }).email;
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
