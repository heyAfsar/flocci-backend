import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware';
import { isAdmin } from '@/lib/admin';
import { isVpsTarget } from '@/lib/pg-shim';
import { getResumeAdmin } from '@/lib/careers-store';

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

  const authRes = await withAuth(req);
  if (authRes) return authRes;

  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const resume = await getResumeAdmin(params.id);
    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    return new NextResponse(resume.content, {
      status: 200,
      headers: {
        'Content-Type': resume.content_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFileName(resume.file_name)}"`,
        'Content-Length': String(resume.content.length),
      },
    });
  } catch (e) {
    console.error('Admin download resume error:', e);
    return NextResponse.json({ error: 'Failed to download resume' }, { status: 500 });
  }
}
