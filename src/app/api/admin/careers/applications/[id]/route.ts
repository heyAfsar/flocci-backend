import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware';
import { isServiceCall, isAdminOrService } from '@/lib/service-auth';
import { isVpsTarget } from '@/lib/pg-shim';
import { resolveSession } from '@/lib/identity';
import { transporter, mailOptions } from '@/lib/nodemailer';
import {
  APPLICATION_STATUSES,
  STATUS_LABEL,
  getApplicationAdmin,
  updateApplicationAdmin,
  appendEvent,
  mapDetail,
  type ApplicationRow,
} from '@/lib/careers-store';

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

  if (!isServiceCall(req)) {
    const authRes = await withAuth(req);
    if (authRes) return authRes;
  }

  if (!(await isAdminOrService(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const result = await getApplicationAdmin(params.id);
    if (!result) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json(
      { application: mapDetail(result.row, result.events, result.resume) },
      { status: 200 }
    );
  } catch (e) {
    console.error('Admin get application error:', e);
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  note: z.string().max(2000).optional(),
  internalNote: z.string().max(2000).optional(),
  notifyCandidate: z.boolean().optional(),
  // Only honoured for S2S calls (flocci-panel-srv has no session email to
  // record as the actor). A session request must never spoof the actor via
  // this field — see below, it's read only inside the `isServiceCall` branch.
  actorEmail: z.string().max(320).optional(),
});

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function buildStatusUpdateEmail(row: ApplicationRow, note: string | undefined): string {
  const statusLabel = STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] || row.status;
  const roleLine = row.product_team ? `${row.job_title} (${row.product_team})` : row.job_title;
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f5f7;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e6e6e6;border-radius:10px;padding:28px 30px;">
      <tr><td style="font:700 20px/1.35 Arial,Helvetica,sans-serif;color:#111111;padding-bottom:12px;">
        Update on your application
      </td></tr>
      <tr><td style="font:400 15px/1.7 Arial,Helvetica,sans-serif;color:#333333;">
        <p style="margin:0 0 14px 0;">Hi ${esc(row.candidate_name)},</p>
        <p style="margin:0 0 14px 0;">Your application for <strong>${esc(roleLine)}</strong> at ${esc(
          row.company_name
        )} (ref. ${esc(row.reference_code)}) has moved to: <strong>${esc(statusLabel)}</strong>.</p>
        ${note && note.trim() ? `<p style="margin:0 0 14px 0;">${esc(note.trim())}</p>` : ''}
        <p style="margin:0;">You can track this application any time from your Flocci dashboard.</p>
      </td></tr>
      <tr><td style="padding:22px 0 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#999999;border-top:1px solid #eeeeee;">
        This is an automated update from ${esc(row.company_name)}.
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isVpsTarget()) {
    return NextResponse.json(
      { error: 'Applications are temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }

  const serviceCall = isServiceCall(req);
  if (!serviceCall) {
    const authRes = await withAuth(req);
    if (authRes) return authRes;
  }

  if (!(await isAdminOrService(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, note, internalNote, notifyCandidate, actorEmail } = parsed.data;

    // Audit-trail actor: a service call has no session, so it may pass
    // `actorEmail` (falling back to 'panel'). A session request always uses
    // its own resolved email — `actorEmail` is IGNORED there, so a session
    // caller can never spoof the actor via the body.
    let actor: string;
    if (serviceCall) {
      actor = (actorEmail && actorEmail.trim()) || 'panel';
    } else {
      const session = await resolveSession(req);
      actor = session?.user.email || 'admin';
    }
    if (!status && note === undefined && !internalNote) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updatedRow = await updateApplicationAdmin(params.id, { status, note, internalNote, actor });
    if (!updatedRow) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (notifyCandidate && status) {
      try {
        await transporter.sendMail(
          mailOptions(
            updatedRow.candidate_email,
            `Update on your application — ${updatedRow.job_title}`,
            buildStatusUpdateEmail(updatedRow, note)
          )
        );
      } catch (mailErr) {
        console.error('Candidate status-update email failed:', mailErr);
        try {
          await appendEvent(undefined, {
            applicationId: params.id,
            kind: 'note',
            title: 'Candidate notification failed',
            body: mailErr instanceof Error ? mailErr.message : 'Unknown email delivery error',
            actor: 'system',
            visibleToCandidate: false,
          });
        } catch (eventErr) {
          console.error('Failed to record notification-failure event:', eventErr);
        }
      }
    }

    const full = await getApplicationAdmin(params.id);
    if (!full) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json(
      { application: mapDetail(full.row, full.events, full.resume) },
      { status: 200 }
    );
  } catch (e) {
    console.error('Admin update application error:', e);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}
