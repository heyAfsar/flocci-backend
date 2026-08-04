import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies } from '@/lib/identity';
import { isVpsTarget } from '@/lib/pg-shim';
import { getResumeForOwner } from '@/lib/careers-store';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/** Strip characters that would break a Content-Disposition filename token. */
const safeFileName = (name: string) => name.replace(/["\r\n]/g, '');

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isVpsTarget()) {
    return NextResponse.json(
      { error: 'Applications are temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }

  try {
    const session = await resolveSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 });
    }

    const resume = await getResumeForOwner(params.id, session.user.id);
    if (!resume) {
      const response = NextResponse.json({ error: 'Resume not found' }, { status: 404 });
      applySetCookies(response, session.setCookies);
      return response;
    }

    const response = new NextResponse(resume.content, {
      status: 200,
      headers: {
        'Content-Type': resume.content_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFileName(resume.file_name)}"`,
        'Content-Length': String(resume.content.length),
      },
    });
    applySetCookies(response, session.setCookies);
    return response;
  } catch (e) {
    console.error('Download resume error:', e);
    return NextResponse.json({ error: 'Failed to download resume' }, { status: 500 });
  }
}
