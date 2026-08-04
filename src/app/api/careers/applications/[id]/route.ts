import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies } from '@/lib/identity';
import { isVpsTarget } from '@/lib/pg-shim';
import { getApplicationForOwner, mapDetail } from '@/lib/careers-store';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

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

    // 404 for both "does not exist" and "not owned by this candidate" — never
    // leak whether some other candidate's application id exists.
    const result = await getApplicationForOwner(params.id, session.user.id);
    if (!result) {
      const response = NextResponse.json({ error: 'Application not found' }, { status: 404 });
      applySetCookies(response, session.setCookies);
      return response;
    }

    const response = NextResponse.json(
      { application: mapDetail(result.row, result.events, result.resume) },
      { status: 200 }
    );
    applySetCookies(response, session.setCookies);
    return response;
  } catch (e) {
    console.error('Get application error:', e);
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 });
  }
}
