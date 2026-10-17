import { NextRequest, NextResponse } from 'next/server';
import { MAX_UPLOAD_BYTES, portalJson, withCandidate } from '@/lib/talent-portal';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withCandidate(req, async (email) => {
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: 'That file is larger than 15 MB.' }, { status: 413 });
    }

    let incoming: FormData;
    try {
      incoming = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Attach a file to upload.' }, { status: 400 });
    }
    const file = incoming.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Attach a file to upload.' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'That file is larger than 15 MB.' }, { status: 413 });
    }

    // Rebuild the form so the only email Talent sees is the session's.
    const out = new FormData();
    out.append('file', file, file.name);
    out.append('email', email);

    const data = await portalJson(`/assignments/${encodeURIComponent(params.id)}/upload`, {
      method: 'POST',
      body: out,
    });
    return NextResponse.json(data);
  });
}
