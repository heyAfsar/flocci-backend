import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware';
import { isAdmin } from '@/lib/admin';
import { isVpsTarget } from '@/lib/pg-shim';
import { listApplicationsAdmin, mapAdminRow, isValidStatus } from '@/lib/careers-store';

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

  const authRes = await withAuth(req);
  if (authRes) return authRes;

  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') || undefined;
    if (statusParam && !isValidStatus(statusParam)) {
      return NextResponse.json({ error: `Invalid status: ${statusParam}` }, { status: 400 });
    }

    const jobIdParam = searchParams.get('jobId');
    const jobId = jobIdParam && !Number.isNaN(Number(jobIdParam)) ? Number(jobIdParam) : undefined;

    const q = searchParams.get('q')?.trim() || undefined;

    const limitParam = Number(searchParams.get('limit') || '50');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const offsetParam = Number(searchParams.get('offset') || '0');
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const { rows, total, stats } = await listApplicationsAdmin({
      status: statusParam,
      jobId,
      q,
      limit,
      offset,
    });

    return NextResponse.json(
      { applications: rows.map(mapAdminRow), total, stats },
      { status: 200 }
    );
  } catch (e) {
    console.error('Admin list applications error:', e);
    return NextResponse.json({ error: 'Failed to load applications' }, { status: 500 });
  }
}
