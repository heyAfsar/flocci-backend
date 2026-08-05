import { transporter, mailOptions, adminEmail } from '@/lib/nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, applySetCookies, type SessionResolution } from '@/lib/identity';
import { isVpsTarget } from '@/lib/pg-shim';
import {
  submitApplication,
  getOpenApplication,
  mapSummary,
  appendEvent,
  contentTypeForFile,
  OpenApplicationExistsError,
} from '@/lib/careers-store';
import {
  careerApplicationSchema,
  type CareerApplication,
  MAX_RESUME_BYTES,
  ALLOWED_RESUME_EXTENSIONS,
} from '@/lib/careers-schema';

/* -------------------------------------------------------------------------- */
/* HTML email building                                                         */
/* -------------------------------------------------------------------------- */

/** Escape every user-supplied value before it touches HTML (incl. href values). */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escMultiline = (value: unknown): string => esc(value).replace(/\r?\n/g, '<br>');

const LABEL_CELL =
  'padding:6px 14px 6px 0;vertical-align:top;font:600 13px/1.5 Arial,Helvetica,sans-serif;color:#555555;white-space:nowrap;';
const VALUE_CELL =
  'padding:6px 0;vertical-align:top;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#111111;';

/** One label/value row. Returns '' when the value is absent, so no empty rows. */
const row = (label: string, valueHtml?: string | false | null): string =>
  valueHtml
    ? `<tr><td style="${LABEL_CELL}">${esc(label)}</td><td style="${VALUE_CELL}">${valueHtml}</td></tr>`
    : '';

/** A titled section. Returns '' when it has no rows, so no empty headings. */
const section = (title: string, rowsHtml: string): string => {
  if (!rowsHtml.trim()) return '';
  return `
    <tr><td style="padding:22px 0 0 0;">
      <div style="font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#7a7a7a;padding-bottom:8px;border-bottom:1px solid #e6e6e6;">${esc(
        title
      )}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin-top:8px;">${rowsHtml}</table>
    </td></tr>`;
};

/** A block of free text (cover letter, screening answer). */
const textBlock = (heading: string, body: string): string => `
  <tr><td style="padding:10px 0 0 0;">
    <div style="font:700 14px/1.5 Arial,Helvetica,sans-serif;color:#111111;">${escMultiline(heading)}</div>
    <div style="font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#333333;padding:4px 0 10px 0;">${escMultiline(
      body
    )}</div>
  </td></tr>`;

/** A block of free text with no inner heading (the section title carries it). */
const paragraphBlock = (body: string): string => `
  <tr><td style="padding:2px 0 4px 0;font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#333333;">${escMultiline(
    body
  )}</td></tr>`;

const link = (href: string, label?: string): string =>
  `<a href="${esc(href)}" style="color:#1a56db;text-decoration:underline;">${esc(label ?? href)}</a>`;

function buildAdminEmail(data: CareerApplication, resumeFileName: string, resumeBytes: number): string {
  const {
    jobId,
    jobSlug,
    jobTitle,
    jobTrack,
    productTeam,
    companyName,
    jobType,
    location,
    isRemote,
    requiredSkills,
    candidateName,
    candidateEmail,
    phone,
    coverLetter,
    links,
    education,
    availability,
    answers,
    meta,
  } = data;

  /* Header ---------------------------------------------------------------- */
  const headerBits = [jobTitle, productTeam].filter(Boolean).join(' · ');

  /* Candidate ------------------------------------------------------------- */
  const candidateRows =
    row('Name', esc(candidateName)) +
    row('Email', link(`mailto:${candidateEmail}`, candidateEmail)) +
    row('Phone', phone ? link(`tel:${phone.replace(/[^\d+]/g, '')}`, phone) : '') +
    row('Resume', `${esc(resumeFileName)} <span style="color:#888;">(${Math.round(resumeBytes / 1024)} KB, attached)</span>`);

  /* Links ----------------------------------------------------------------- */
  const workLinks = (links?.work ?? []).filter((u): u is string => Boolean(u));
  const linkRows =
    row('LinkedIn', links?.linkedin ? link(links.linkedin) : '') +
    row('GitHub', links?.github ? link(links.github) : '') +
    row('Portfolio', links?.portfolio ? link(links.portfolio) : '') +
    (workLinks.length
      ? row('Work', workLinks.map((u) => link(u)).join('<br>'))
      : '');

  /* Education ------------------------------------------------------------- */
  const scoreValue =
    education?.score
      ? `${esc(education.score)}${education.scoreType ? ` <span style="color:#888;">(${esc(education.scoreType.toUpperCase())})</span>` : ''}`
      : '';
  const educationRows =
    row('Institution', education?.institution ? esc(education.institution) : '') +
    row(
      'Programme',
      [education?.degree, education?.branch].filter(Boolean).map((v) => esc(v)).join(' — ') || ''
    ) +
    row('Year of study', education?.yearOfStudy ? esc(education.yearOfStudy) : '') +
    row('Graduating', education?.graduationYear ? esc(education.graduationYear) : '') +
    row('Score', scoreValue) +
    row('City', education?.city ? esc(education.city) : '');

  /* Availability ---------------------------------------------------------- */
  const availabilityRows =
    row('Earliest start', availability?.earliestStart ? esc(availability.earliestStart) : '') +
    row(
      'Hours / week',
      availability?.hoursPerWeek !== undefined ? esc(`${availability.hoursPerWeek} hrs`) : ''
    ) +
    row(
      'College-mandated OJT',
      availability?.isCollegeMandated === undefined
        ? ''
        : availability.isCollegeMandated
          ? 'Yes — industrial training requirement'
          : 'No — applying independently'
    ) +
    row('Training window', availability?.trainingWindow ? esc(availability.trainingWindow) : '') +
    row(
      'Mentor / TPO',
      availability?.mentorEmail ? link(`mailto:${availability.mentorEmail}`, availability.mentorEmail) : ''
    );

  /* Screening answers — generic, renders whatever the job posted ----------- */
  const answerRows = (answers ?? [])
    .filter((a) => a.question.trim() && a.answer.trim())
    .map((a) => textBlock(a.question.trim(), a.answer.trim()))
    .join('');

  /* Cover letter ---------------------------------------------------------- */
  const coverRows = coverLetter && coverLetter.trim() ? paragraphBlock(coverLetter.trim()) : '';

  /* Role details ---------------------------------------------------------- */
  const roleRows =
    row('Position', esc(jobTitle)) +
    row('Track', jobTrack ? esc(jobTrack) : '') +
    row('Product team', productTeam ? esc(productTeam) : '') +
    row('Type', jobType ? esc(jobType) : '') +
    row('Location', location ? esc(location) : '') +
    row('Remote', isRemote === undefined ? '' : isRemote ? 'Yes' : 'No') +
    row('Company', esc(companyName)) +
    row('Job ID', esc(jobId)) +
    row('Slug', jobSlug ? esc(jobSlug) : '') +
    row('Skills', requiredSkills?.length ? esc(requiredSkills.join(', ')) : '') +
    row('Source', meta?.source ? esc(meta.source) : '') +
    row('Applied from', meta?.pageUrl ? link(meta.pageUrl) : '') +
    row('Submitted at', meta?.submittedAt ? esc(meta.submittedAt) : '');

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f5f7;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e6e6e6;border-radius:10px;padding:26px 28px;">
      <tr><td>
        <div style="font:700 20px/1.35 Arial,Helvetica,sans-serif;color:#111111;">New application — ${esc(
          headerBits
        )}</div>
        <div style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#555555;padding-top:4px;">${esc(
          candidateName
        )} applied for ${esc(jobTitle)}${productTeam ? ` on ${esc(productTeam)}` : ''} at ${esc(companyName)}.</div>
      </td></tr>
      ${section('Candidate', candidateRows)}
      ${section('Links', linkRows)}
      ${section('Education', educationRows)}
      ${section('Availability', availabilityRows)}
      ${section('Screening answers', answerRows)}
      ${section('Cover letter', coverRows)}
      ${section('Role details', roleRows)}
      <tr><td style="padding:24px 0 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#999999;border-top:1px solid #eeeeee;">
        Sent by the Flocci careers API. Reply to this email to reach the candidate directly.
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

function buildCandidateAcknowledgementEmail(data: CareerApplication): string {
  const { candidateName, jobTitle, productTeam, companyName } = data;
  const roleLine = productTeam ? `${jobTitle} (${productTeam})` : jobTitle;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f5f7;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e6e6e6;border-radius:10px;padding:28px 30px;">
      <tr><td style="font:700 20px/1.35 Arial,Helvetica,sans-serif;color:#111111;padding-bottom:12px;">
        We've got your application
      </td></tr>
      <tr><td style="font:400 15px/1.7 Arial,Helvetica,sans-serif;color:#333333;">
        <p style="margin:0 0 14px 0;">Hi ${esc(candidateName)},</p>
        <p style="margin:0 0 14px 0;">Thanks for applying for <strong>${esc(
          roleLine
        )}</strong> at ${esc(companyName)}. Your application and resume have reached us.</p>
        <p style="margin:0 0 14px 0;">What happens next: we read every application ourselves. If yours is shortlisted, we'll email you at this address with the next step. If you don't hear from us, it means we've gone ahead with other candidates for this cohort — you're welcome to apply again.</p>
        <p style="margin:0 0 14px 0;">Nothing is needed from you right now. If you want to add something to your application, just reply to this email.</p>
        <p style="margin:0;">— Team Flocci</p>
      </td></tr>
      <tr><td style="padding:22px 0 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#999999;border-top:1px solid #eeeeee;">
        This is an automated confirmation from ${esc(companyName)}. We never ask applicants for a fee at any stage.
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/* -------------------------------------------------------------------------- */
/* Route handlers                                                              */
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

  // Identity is the session, not the payload — a candidate must not be able
  // to apply as someone else, and every response from here on must forward
  // any rotated platform cookies (silent refresh) via applySetCookies.
  let session: SessionResolution | null;
  try {
    session = await resolveSession(req);
  } catch (e) {
    console.error('Career application session resolution error:', e);
    session = null;
  }
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to apply' }, { status: 401 });
  }

  const json = (body: Record<string, unknown>, status: number) => {
    const response = NextResponse.json(body, { status });
    if (session!.setCookies.length) applySetCookies(response, session!.setCookies);
    return response;
  };

  try {
    const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Override the payload's identity fields with the signed-in profile's —
    // the payload's own candidateEmail/candidateName are never trusted.
    rawBody.candidateEmail = session.user.email;
    if (!rawBody.candidateName || String(rawBody.candidateName).trim() === '') {
      rawBody.candidateName = session.user.full_name || session.user.email.split('@')[0] || 'Candidate';
    }

    const parseResult = careerApplicationSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return json({ error: 'Invalid input', details: parseResult.error.flatten() }, 400);
    }

    const data = parseResult.data;
    const { candidateName, candidateEmail, resumeBase64, resumeFileName, jobTitle, jobId } = data;

    // One unresolved application per candidate, across every role — this is
    // the cheap pre-check; the DB partial unique index is the real rule and
    // is enforced again (and always) inside submitApplication below.
    const existingOpen = await getOpenApplication(session.user.id);
    if (existingOpen) {
      return json(
        {
          error:
            'You already have an application in progress. Track its status or withdraw it from your dashboard before applying again.',
          openApplication: existingOpen,
        },
        409
      );
    }

    // NOTE: the old 24h Redis dedup key (email + jobId) was removed here on
    // purpose. It now contradicts the rule it used to approximate: once an
    // application is rejected or withdrawn the candidate is explicitly free to
    // apply again — including to the same role — but the Redis key would still
    // refuse them for the rest of the 24h window, with a 409 that carries no
    // `openApplication` for the UI to explain. The partial unique index
    // (`uq_career_applications_one_open`) plus the transactional insert below
    // are the authority, and they are race-safe on their own.

    // Resume extension allowlist
    const loweredFileName = resumeFileName.trim().toLowerCase();
    const extension = loweredFileName.slice(loweredFileName.lastIndexOf('.'));
    if (!ALLOWED_RESUME_EXTENSIONS.includes(extension)) {
      return json(
        {
          error: 'Unsupported resume format',
          details: `Resume must be one of: ${ALLOWED_RESUME_EXTENSIONS.join(', ')}`,
        },
        400
      );
    }

    // Convert base64 resume to Buffer for storage + attachment
    let resumeBuffer: Buffer;
    try {
      const base64Data = resumeBase64.includes('base64,')
        ? resumeBase64.split('base64,')[1]
        : resumeBase64;

      if (!base64Data) {
        throw new Error('Invalid base64 data format');
      }

      resumeBuffer = Buffer.from(base64Data, 'base64');

      if (resumeBuffer.length === 0) {
        throw new Error('Empty file content');
      }
    } catch (error) {
      console.error('Error processing resume file:', error);
      return json(
        {
          error: 'Failed to process resume file',
          details: error instanceof Error ? error.message : 'Invalid file format',
        },
        400
      );
    }

    // Decoded-size cap — matches the client-side 5 MB limit
    if (resumeBuffer.length > MAX_RESUME_BYTES) {
      return json(
        {
          error: 'Resume file is too large',
          details: `Resume must be 5 MB or smaller (received ${(
            resumeBuffer.length /
            (1024 * 1024)
          ).toFixed(1)} MB)`,
        },
        400
      );
    }

    // Persist FIRST — an application that reached the database must never be
    // lost to a downstream SMTP failure.
    let applicationRow;
    try {
      applicationRow = await submitApplication({
        profileId: session.user.id,
        jobId: data.jobId,
        jobSlug: data.jobSlug ?? null,
        jobTitle: data.jobTitle,
        jobTrack: data.jobTrack ?? null,
        productTeam: data.productTeam ?? null,
        companyName: data.companyName,
        jobType: data.jobType ?? null,
        location: data.location ?? null,
        isRemote: data.isRemote ?? false,
        candidateName,
        candidateEmail,
        phone: data.phone ?? null,
        links: data.links ?? {},
        education: data.education ?? {},
        availability: data.availability ?? {},
        answers: data.answers ?? [],
        requiredSkills: data.requiredSkills ?? [],
        coverLetter: data.coverLetter ?? null,
        meta: data.meta ?? {},
        resumeFileName,
        resumeContentType: contentTypeForFile(resumeFileName),
        resumeSizeBytes: resumeBuffer.length,
        resumeContent: resumeBuffer,
      });
    } catch (e) {
      if (e instanceof OpenApplicationExistsError) {
        // Race: two submissions landed together and the DB's partial unique
        // index caught the second one. Never let this 500 — same clean 409.
        const openApplication = await getOpenApplication(session.user.id);
        return json(
          {
            error:
              'You already have an application in progress. Track its status or withdraw it from your dashboard before applying again.',
            openApplication,
          },
          409
        );
      }
      throw e;
    }

    const emailHtml = buildAdminEmail(data, resumeFileName, resumeBuffer.length);

    // Send email with attachment — best-effort. The application is already
    // safely stored, so a notification failure must not fail the request.
    try {
      const mailOpts = {
        ...mailOptions(
          adminEmail,
          `New Job Application from ${candidateName} for ${jobTitle}`,
          emailHtml
        ),
        replyTo: candidateEmail,
        attachments: [
          {
            filename: resumeFileName,
            content: resumeBuffer,
          },
        ],
      };
      await transporter.sendMail(mailOpts);
    } catch (mailErr) {
      console.error(
        'Admin notification email failed (application was still recorded):',
        mailErr
      );
      try {
        await appendEvent(undefined, {
          applicationId: applicationRow.id,
          kind: 'note',
          title: 'Team notification failed',
          body: mailErr instanceof Error ? mailErr.message : 'Unknown email delivery error',
          actor: 'system',
          visibleToCandidate: false,
        });
      } catch (eventErr) {
        console.error('Failed to record notification-failure event:', eventErr);
      }
    }

    // Candidate acknowledgement — outward-facing, best-effort only. A failure
    // here must never fail an application that has already reached the team.
    try {
      await transporter.sendMail(
        mailOptions(
          candidateEmail,
          `We've received your application — ${jobTitle} at ${data.companyName}`,
          buildCandidateAcknowledgementEmail(data)
        )
      );
    } catch (ackError) {
      console.error(
        'Candidate acknowledgement email failed (application was still recorded):',
        ackError
      );
    }

    return json(
      { message: 'Application submitted successfully!', application: mapSummary(applicationRow) },
      201
    );
  } catch (e) {
    console.error('Career application error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';

    // Check if it's a Nodemailer specific error or timeout
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT') {
        return json(
          {
            error:
              'Failed to connect to SMTP server. Please try again later or check server configuration.',
            details: errorMessage,
          },
          503
        );
      }
    }

    return json(
      { error: 'Failed to submit application', details: errorMessage },
      500
    );
  }
}
