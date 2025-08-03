import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hashedToken = await hashToken(sessionToken);
  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('custom_users(email)')
    .eq('token', hashedToken);

  console.log('Sessions Data:', sessions);
  console.log('Error:', error);
  if (sessions && sessions.length > 0) {
    console.log('First session:', sessions[0]);
    console.log('custom_users:', sessions[0].custom_users);
  }

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const filePath = path.resolve('./src/app/api/amity/ai_screening_v3.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  return NextResponse.json(JSON.parse(fileContent));
}

export async function PATCH(req: NextRequest) {
  const sessionToken = req.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { candidate_email, interview_marks } = await req.json();

    if (!candidate_email) {
      return NextResponse.json({ error: 'candidate_email is required' }, { status: 400 });
    }

    const filePath = path.resolve('./src/app/api/amity/ai_screening_v3.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    const candidate = data.results?.find((c: any) => c.candidate_email === candidate_email);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Initialize interview_marks if it doesn't exist
    if (!candidate.interview_marks) {
      candidate.interview_marks = {};
    }

    // Merge new marks with existing marks (partial update)
    candidate.interview_marks = {
      ...candidate.interview_marks,
      ...interview_marks
    };

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: 'Interview marks updated successfully',
      candidate 
    });

  } catch (error) {
    console.error('Error updating interview marks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
