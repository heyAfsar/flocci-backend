import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies } from '@/lib/identity';
import { isVpsTarget } from '@/lib/pg-shim';
import { hasCommittedChallenge, PortalError } from '@/lib/talent-portal';
import {
  withdrawApplication,
  mapSummary,
  ApplicationNotFoundError,
  ApplicationNotOpenError,
} from '@/lib/careers-store';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    let reason: string | undefined;
    try {
      const body = (await req.json()) as { reason?: unknown };
      reason = typeof body?.reason === 'string' ? body.reason : undefined;
    } catch {
      reason = undefined;
    }

    const json = (body: Record<string, unknown>, status: number) => {
      const response = NextResponse.json(body, { status });
      applySetCookies(response, session.setCookies);
      return response;
    };

    try {
      const email = String(session.user.email || '').trim().toLowerCase();
      if (email && (await hasCommittedChallenge(email))) {
        return json(
          { error: 'You accepted a Round 1 challenge, so this application can no longer be withdrawn.' },
          409
        );
      }
      const updated = await withdrawApplication(params.id, session.user.id, reason);
      return json({ application: mapSummary(updated) }, 200);
    } catch (e) {
      if (e instanceof ApplicationNotFoundError) {
        return json({ error: 'Application not found' }, 404);
      }
      if (e instanceof PortalError) {
        return json({ error: 'We could not check your challenge right now. Please try again shortly.' }, 503);
      }
      if (e instanceof ApplicationNotOpenError) {
        return json(
          { error: 'This application is already closed and cannot be withdrawn again.' },
          409
        );
      }
      throw e;
    }
  } catch (e) {
    console.error('Withdraw application error:', e);
    return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 });
  }
}
