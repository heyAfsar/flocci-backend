import { NextRequest, NextResponse } from 'next/server';
import { portalRaw, withCandidate } from '@/lib/talent-portal';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string; key: string } }) {
  return withCandidate(req, async (email) => {
    const upstream = await portalRaw(
      `/assignments/${encodeURIComponent(params.id)}/files/${encodeURIComponent(params.key)}?email=${encodeURIComponent(email)}`
    );
    const headers = new Headers();
    for (const h of ['content-type', 'content-disposition', 'content-length']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('Cache-Control', 'private, no-store');
    return new Response(upstream.body, { status: 200, headers });
  });
}
