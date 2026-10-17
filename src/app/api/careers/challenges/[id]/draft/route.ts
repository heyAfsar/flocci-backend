import { NextRequest, NextResponse } from 'next/server';
import { portalPostJson, readSubmission, withCandidate } from '@/lib/talent-portal';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  return withCandidate(req, async (email) => {
    const data = await portalPostJson(
      `/assignments/${encodeURIComponent(params.id)}/draft`,
      { email, submission: readSubmission(body) }
    );
    return NextResponse.json(data);
  });
}
