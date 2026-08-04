import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies } from '@/lib/identity';
import { isVpsTarget } from '@/lib/pg-shim';
import { getOpenApplication } from '@/lib/careers-store';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
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

    const openApplication = await getOpenApplication(session.user.id);
    const response = NextResponse.json(
      {
        canApply: !openApplication,
        reason: openApplication ? 'has_open_application' : 'ok',
        openApplication,
      },
      { status: 200 }
    );
    applySetCookies(response, session.setCookies);
    return response;
  } catch (e) {
    console.error('Careers eligibility error:', e);
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 });
  }
}
