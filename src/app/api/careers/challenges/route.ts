import { NextRequest, NextResponse } from 'next/server';
import { portalConfigured, portalJson, withCandidate } from '@/lib/talent-portal';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  return withCandidate(
    req,
    async (email) => {
      if (!portalConfigured()) {
        return NextResponse.json({ candidate: null, assignments: [], available: false });
      }
      const data = await portalJson<Record<string, unknown>>(`/assessments?email=${encodeURIComponent(email)}`);
      return NextResponse.json({ ...data, available: true });
    },
    { requireKey: false }
  );
}
