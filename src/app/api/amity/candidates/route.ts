import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: session, error } = await supabaseAdmin
    .from('sessions')
    .select('custom_users(email)')
    .eq('token', sessionToken)
    .single();

  if (error || !session || session.custom_users[0]?.email !== 'placementdrive@amity.in') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const filePath = path.resolve('./src/app/api/amity/processing_v3.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  return NextResponse.json(JSON.parse(fileContent));
}
