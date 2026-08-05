import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware';
import { isServiceCall, isAdminOrService } from '@/lib/service-auth';
import { isVpsTarget } from '@/lib/pg-shim';
import { getApplicationsSummaryAdmin } from '@/lib/careers-store';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

/**
 * Executive careers summary for the control-plane panel — aggregate counts
 * only, no full application rows. Dual auth: a human admin session, or a
 * sibling Flocci service (flocci-panel-srv) presenting X-Flocci-Service-Key.
 */
export async function GET(req: NextRequest) {
  if (!isVpsTarget()) {
    return NextResponse.json(
      { error: 'Applications are temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }

  if (!isServiceCall(req)) {
    const authRes = await withAuth(req);
    if (authRes) return authRes;
  }

  if (!(await isAdminOrService(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const summary = await getApplicationsSummaryAdmin();
    return NextResponse.json(summary, { status: 200 });
  } catch (e) {
    console.error('Admin careers summary error:', e);
    return NextResponse.json({ error: 'Failed to load careers summary' }, { status: 500 });
  }
}
