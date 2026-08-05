import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware';
import { isServiceCall, isAdminOrService } from '@/lib/service-auth';
import { isVpsTarget } from '@/lib/pg-shim';
import {
  careerApplicationSchema,
  optionalText,
  MAX_RESUME_BYTES,
  ALLOWED_RESUME_EXTENSIONS,
} from '@/lib/careers-schema';
import {
  importApplication,
  findImportedApplication,
  resolveOrCreateProfileByEmail,
  appendEvent,
  getOpenApplication,
  mapSummary,
  contentTypeForFile,
  IMPORTABLE_STATUSES,
  OpenApplicationExistsError,
} from '@/lib/careers-store';

/**
 * Historical application importer.
 *
 * Before 2026-08-05 `POST /api/careers` only built an email — it wrote to no
 * table, so every application that arrived before that date exists ONLY as a
 * message in the team's Sent Mail. `scripts/import-careers-emails.mjs` reads
 * those messages back and replays them through THIS route, which is the same
 * validated contract a live application goes through (`careerApplicationSchema`),
 * plus the four things an import needs and a live submission cannot have:
 * an authoritative candidate email, the real historical timestamp, a chosen
 * final status, and total silence — no email of any kind is sent from here.
 *
 * One-time in intent, reusable in shape: it is idempotent, so it can be re-run
 * safely, and it is the correct door for any future mailbox backfill.
 */

/* -------------------------------------------------------------------------- */
/* Schema — the live contract plus import-only fields                          */
/* -------------------------------------------------------------------------- */

const importApplicationSchema = careerApplicationSchema.extend({
  /**
   * Authoritative here. A live application takes the candidate's identity from
   * the session and ignores the payload; an import has no session, so the
   * address recovered from the original message's Reply-To header IS the
   * identity. `careerApplicationSchema` already validates the format.
   */
  candidateEmail: z.string().email('Invalid email address'),

  /** The real historical submission time. Never `now()`. */
  submittedAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'submittedAt must be a parseable ISO date string'),

  status: z.enum(IMPORTABLE_STATUSES).default('submitted'),

  /** Event body for the closing event on a non-`submitted` import. */
  withdrawReason: optionalText(2000),

  /**
   * The address the candidate actually typed, when it differs from the
   * identity this application is filed under — either a corrected typo, or a
   * duplicate address merged into the person's primary one. Recording it keeps
   * BOTH addresses on the record (the hiring team needs to know a candidate
   * applied under two identities) while the applications still land on one
   * profile, so the candidate sees their whole history in one dashboard.
   */
  submittedFromEmail: z.string().max(320).optional(),

  /**
   * Relaxed from the live contract on purpose: the live form makes a resume
   * mandatory, but a handful of historical messages may have lost or never
   * carried an attachment, and refusing those would silently drop real
   * applications. Everything else is validated identically.
   */
  resumeBase64: z.string().optional(),
  resumeFileName: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  if (!isVpsTarget()) {
    return NextResponse.json(
      { error: 'Applications are temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }

  // A service call (the importer script, flocci-panel-srv) has no browser
  // session — skip the cookie gate for it, exactly like the sibling admin
  // careers routes, and keep the human-admin session check otherwise.
  if (!isServiceCall(req)) {
    const authRes = await withAuth(req);
    if (authRes) return authRes;
  }

  if (!(await isAdminOrService(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const parseResult = importApplicationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const submittedAt = new Date(data.submittedAt).toISOString();
    const candidateEmail = data.candidateEmail.trim().toLowerCase();

    /* --- Resume (optional on this path) ----------------------------------- */
    let resumeBuffer: Buffer | null = null;
    let resumeFileName: string | null = null;

    if (data.resumeBase64) {
      if (!data.resumeFileName) {
        return NextResponse.json(
          { error: 'resumeFileName is required when resumeBase64 is present' },
          { status: 400 }
        );
      }
      resumeFileName = data.resumeFileName;

      const lowered = resumeFileName.trim().toLowerCase();
      const extension = lowered.slice(lowered.lastIndexOf('.'));
      if (!ALLOWED_RESUME_EXTENSIONS.includes(extension)) {
        return NextResponse.json(
          {
            error: 'Unsupported resume format',
            details: `Resume must be one of: ${ALLOWED_RESUME_EXTENSIONS.join(', ')}`,
          },
          { status: 400 }
        );
      }

      try {
        const base64Data = data.resumeBase64.includes('base64,')
          ? data.resumeBase64.split('base64,')[1]
          : data.resumeBase64;
        if (!base64Data) throw new Error('Invalid base64 data format');
        resumeBuffer = Buffer.from(base64Data, 'base64');
        if (resumeBuffer.length === 0) throw new Error('Empty file content');
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Failed to process resume file',
            details: error instanceof Error ? error.message : 'Invalid file format',
          },
          { status: 400 }
        );
      }

      if (resumeBuffer.length > MAX_RESUME_BYTES) {
        return NextResponse.json(
          {
            error: 'Resume file is too large',
            details: `Resume must be 5 MB or smaller (received ${(
              resumeBuffer.length /
              (1024 * 1024)
            ).toFixed(1)} MB)`,
          },
          { status: 400 }
        );
      }
    }

    /* --- Profile: resolve by email, or provision a detached one ------------ */
    const { id: profileId, created: profileCreated } = await resolveOrCreateProfileByEmail(
      candidateEmail,
      data.candidateName
    );

    /* --- Idempotency: (profile_id, job_id, submitted_at) ------------------- */
    const already = await findImportedApplication(profileId, data.jobId, submittedAt);
    if (already) {
      return NextResponse.json(
        { imported: false, application: mapSummary(already) },
        { status: 200 }
      );
    }

    /* --- Insert ------------------------------------------------------------ */
    let applicationRow;
    try {
      applicationRow = await importApplication({
        profileId,
        jobId: data.jobId,
        jobSlug: data.jobSlug ?? null,
        jobTitle: data.jobTitle,
        jobTrack: data.jobTrack ?? null,
        productTeam: data.productTeam ?? null,
        companyName: data.companyName,
        jobType: data.jobType ?? null,
        location: data.location ?? null,
        isRemote: data.isRemote ?? false,
        candidateName: data.candidateName,
        candidateEmail,
        phone: data.phone ?? null,
        links: data.links ?? {},
        education: data.education ?? {},
        availability: data.availability ?? {},
        answers: data.answers ?? [],
        requiredSkills: data.requiredSkills ?? [],
        coverLetter: data.coverLetter ?? null,
        meta: {
          ...(data.meta ?? {}),
          importedFrom: 'sent-mail',
          importedAt: new Date().toISOString(),
          ...(data.submittedFromEmail && data.submittedFromEmail.toLowerCase() !== candidateEmail
            ? { submittedFromEmail: data.submittedFromEmail.toLowerCase() }
            : {}),
        },
        submittedAt,
        status: data.status,
        closingReason: data.withdrawReason ?? null,
        resumeFileName,
        resumeContentType: resumeFileName ? contentTypeForFile(resumeFileName) : null,
        resumeSizeBytes: resumeBuffer ? resumeBuffer.length : null,
        resumeContent: resumeBuffer,
      });
    } catch (e) {
      if (e instanceof OpenApplicationExistsError) {
        // The one-open-application partial unique index caught a second OPEN
        // row for this profile. That is a real data decision for a human to
        // make (which one stays open) — a clean 409, never a 500.
        const openApplication = await getOpenApplication(profileId);
        return NextResponse.json(
          {
            error:
              'This candidate already has an open application. Import the extra ones with status "withdrawn" or "rejected".',
            openApplication,
          },
          { status: 409 }
        );
      }
      throw e;
    }

    // An alternate address is a hiring-team fact, not a candidate-facing one:
    // record it as an INTERNAL event so the panel shows it on the timeline
    // without the applicant reading a note about their own typo/duplicate.
    if (data.submittedFromEmail && data.submittedFromEmail.toLowerCase() !== candidateEmail) {
      try {
        await appendEvent(undefined, {
          applicationId: applicationRow.id,
          kind: 'note',
          title: 'Submitted from an alternate address',
          body: `Originally submitted as ${data.submittedFromEmail.toLowerCase()}; filed under ${candidateEmail} so the candidate sees one history.`,
          actor: 'import',
          visibleToCandidate: false,
        });
      } catch (e) {
        // The application itself is what matters — never fail an import over
        // an annotation.
        console.error('import: alternate-address note failed', e);
      }
    }

    // NOTE: no email is sent from this route — not the admin notification, not
    // the candidate acknowledgement. These candidates were already emailed the
    // day they applied; re-notifying them months later would be a fresh, wrong
    // message. Do not add a transporter call here.

    return NextResponse.json(
      { imported: true, profileCreated, application: mapSummary(applicationRow) },
      { status: 201 }
    );
  } catch (e) {
    console.error('Career application import error:', e);
    return NextResponse.json(
      { error: 'Failed to import application', details: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
