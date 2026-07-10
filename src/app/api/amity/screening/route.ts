import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashToken, extractSessionToken } from '@/lib/auth';
import { identityEnabled, resolveSession } from '@/lib/identity';
import path from 'path';
import fs from 'fs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** The drive gate: only the hardcoded placement-drive account passes. */
async function amityGate(req: NextRequest): Promise<NextResponse | null> {
  if (identityEnabled()) {
    // Identity mode: the drive account signs in with its Flocci account.
    const session = await resolveSession(req);
    if (session?.user.email === 'placementdrive@amity.in') return null;
    return NextResponse.json({ error: session ? 'Forbidden' : 'Unauthorized' }, { status: session ? 403 : 401, headers: CORS });
  }
  const sessionToken = extractSessionToken(req);
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }
  const hashedToken = await hashToken(sessionToken);
  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('custom_users(email)')
    .eq('token', hashedToken);
  let email;
  const cu = sessions && sessions.length > 0 ? sessions[0].custom_users : undefined;
  if (cu) {
    email = Array.isArray(cu) ? cu[0]?.email : (cu as { email: string }).email;
  }
  if (error || !sessions || sessions.length === 0 || !email || email !== 'placementdrive@amity.in') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: CORS });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await amityGate(req);
  if (denied) return denied;

  const filePath = path.resolve('./src/app/api/amity/ai_screening_v3.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(fileContent);

  // Fetch interview marks from database and merge with file data
  try {
    const { data: dbInterviewMarks, error: dbError } = await supabaseAdmin
      .from('interview_marks')
      .select('candidate_email, interview_marks');

    if (!dbError && dbInterviewMarks) {
      // Create a map of interview marks by email for quick lookup
      const interviewMarksMap = new Map();
      dbInterviewMarks.forEach((record: any) => {
        interviewMarksMap.set(record.candidate_email, record.interview_marks);
      });

      // Merge database interview marks with file data
      data.results?.forEach((candidate: any) => {
        const dbMarks = interviewMarksMap.get(candidate.candidate_email);
        if (dbMarks) {
          candidate.interview_marks = dbMarks;
        }
      });
    } else {
      console.log('No database interview marks found or error:', dbError);
    }
  } catch (error) {
    console.error('Error fetching interview marks from database:', error);
    // Continue with file data only
  }

  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export async function POST(req: NextRequest) {
  const denied = await amityGate(req);
  if (denied) return denied;

  try {
    console.log('POST request received');
    const { candidate_email, interview_marks } = await req.json();
    console.log('Request body parsed:', { candidate_email, interview_marks });

    if (!candidate_email) {
      return NextResponse.json({ error: 'candidate_email is required' }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const filePath = path.resolve('./src/app/api/amity/ai_screening_v3.json');
    
    try {
      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      const candidate = data.results?.find((c: any) => c.candidate_email === candidate_email);
      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });
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

      // Store interview marks in database instead of file
      try {
        const { data: dbResult, error: dbError } = await supabaseAdmin
          .from('interview_marks')
          .upsert({
            candidate_email,
            interview_marks: candidate.interview_marks,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'candidate_email'
          });

        if (dbError) {
          console.error('Database error:', dbError);
          throw new Error(`Database operation failed: ${dbError.message}`);
        }

        console.log('Interview marks saved to database successfully');

        return NextResponse.json({ 
          success: true, 
          message: 'Interview marks updated successfully in database',
          candidate: {
            ...candidate,
            interview_marks: candidate.interview_marks
          }
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });

      } catch (dbError) {
        console.error('Database operation failed:', dbError);
        
        // Fallback: try to write to file (will fail in production but work locally)
        try {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          console.log('Fallback: Saved to file successfully');

          return NextResponse.json({ 
            success: true, 
            message: 'Interview marks updated successfully (file fallback)',
            candidate 
          }, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
          });
        } catch (fileError) {
          // Both database and file failed
          return NextResponse.json({ 
            success: false,
            error: 'Failed to persist interview marks',
            message: 'Both database and file storage failed',
            db_error: dbError instanceof Error ? dbError.message : 'Unknown database error',
            file_error: fileError instanceof Error ? fileError.message : 'Unknown file error',
            candidate_email,
            interview_marks
          }, { 
            status: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
          });
        }
      }

    } catch (fileError) {
      console.error('File operation error:', fileError);
      
      // Return error when file write fails - data is not actually persisted
      return NextResponse.json({ 
        success: false,
        error: 'Failed to persist interview marks',
        message: 'File write failed in serverless environment - data not saved',
        details: fileError instanceof Error ? fileError.message : 'Unknown file error',
        candidate_email,
        interview_marks
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

  } catch (error) {
    console.error('Error updating interview marks:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
