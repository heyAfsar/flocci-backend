import { transporter, mailOptions, adminEmail } from '@/lib/nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Redis } from '@upstash/redis';

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

// Resume hardening — mirrors the client-side limits.
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB decoded
const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const MAX_URL_LENGTH = 500;
const MAX_WORK_LINKS = 10;

/** Blank-ish strings behave as "not provided" so we never render empty rows. */
const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/** Optional trimmed text that collapses blanks to `undefined`. */
const optionalText = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(max)
      .transform((v) => v.trim())
      .optional()
  );

/** Optional integer that tolerates a numeric string from a form field. */
const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => {
      const cleaned = emptyToUndefined(v);
      if (cleaned === null || cleaned === undefined) return undefined;
      return typeof cleaned === 'string' ? Number(cleaned) : cleaned;
    },
    z.number().int().min(min).max(max).optional()
  );

/**
 * URL normalisation decision: we NORMALISE, then validate strictly.
 * A candidate pasting `linkedin.com/in/afsar` or `www.github.com/x` must never be
 * rejected for a missing protocol, so a bare host is prefixed with `https://`
 * before the value is validated as a real absolute http(s) URL.
 */
function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname.includes('.') || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

/** Optional URL field: blank -> undefined, bare host -> https://, then validated. */
const optionalUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .max(MAX_URL_LENGTH, `Link must be ${MAX_URL_LENGTH} characters or fewer`)
    .transform(normaliseUrl)
    .refine(isHttpUrl, 'Must be a valid URL')
    .optional()
);

/* -------------------------------------------------------------------------- */
/* Schema — mirrors the shared ApplicationPayload contract                     */
/* -------------------------------------------------------------------------- */

const careerApplicationSchema = z.object({
  // --- job identity ---
  jobId: z.number(),
  jobSlug: optionalText(200),
  jobTitle: z.string().min(1, 'Job title is required'),
  jobTrack: optionalText(200),
  productTeam: optionalText(200),
  companyName: z.string().min(1, 'Company name is required'),
  jobType: optionalText(120),
  location: optionalText(200),
  isRemote: z.boolean().optional(),
  requiredSkills: z.array(z.string().max(120)).max(50).optional(),

  // --- candidate ---
  candidateName: z.string().min(1, 'Name is required'),
  candidateEmail: z.string().email('Invalid email address'),
  phone: optionalText(40),

  // --- resume ---
  resumeBase64: z.string().min(1, 'Resume is required'),
  resumeFileName: z.string().min(1, 'Resume filename is required'),

  coverLetter: z.string().optional(),

  // --- optional blocks: any job type may post as much or as little as it has ---
  links: z
    .object({
      linkedin: optionalUrl,
      github: optionalUrl,
      portfolio: optionalUrl,
      work: z.array(optionalUrl).max(MAX_WORK_LINKS, `At most ${MAX_WORK_LINKS} links`).optional(),
    })
    .optional(),

  education: z
    .object({
      institution: optionalText(200),
      degree: optionalText(120),
      branch: optionalText(120),
      yearOfStudy: optionalText(60),
      graduationYear: optionalInt(1900, 2100),
      scoreType: z.preprocess(emptyToUndefined, z.enum(['cgpa', 'percentage']).optional()),
      score: optionalText(40),
      city: optionalText(120),
    })
    .optional(),

  availability: z
    .object({
      earliestStart: optionalText(60),
      hoursPerWeek: optionalInt(0, 168),
      isCollegeMandated: z.boolean().optional(),
      trainingWindow: optionalText(300),
      mentorEmail: z.preprocess(
        emptyToUndefined,
        z.string().email('Invalid mentor email address').optional()
      ),
    })
    .optional(),

  /**
   * The forward-compatible escape hatch: ANY future job can post arbitrary
   * screening Q&A here and the admin email renders it without a code change.
   */
  answers: z
    .array(
      z.object({
        id: optionalText(120),
        question: z.string().max(500),
        answer: z.string().max(10000),
      })
    )
    .max(50)
    .optional(),

  meta: z
    .object({
      source: optionalText(120),
      pageUrl: optionalUrl,
      submittedAt: optionalText(60),
    })
    .optional(),

  // Legacy fields — accepted so an older deployed client cannot break, but the
  // new postings are unpaid industrial-training internships, so they are never
  // rendered. Do not reintroduce a rupee range on this page.
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
});

type CareerApplication = z.infer<typeof careerApplicationSchema>;

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
  try {
    const body = await req.json();
    const parseResult = careerApplicationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const { candidateName, candidateEmail, resumeBase64, resumeFileName, jobTitle, jobId } = data;

    // Optional Redis deduplication check (24h window per candidate email + job ID)
    const redis = getRedisClient();
    const dedupKey = `careers:dedup:${candidateEmail.toLowerCase().trim()}:${jobId}`;

    if (redis) {
      try {
        const alreadyApplied = await redis.get(dedupKey);
        if (alreadyApplied) {
          return NextResponse.json(
            {
              error: 'Application already submitted',
              details:
                'You have already submitted an application for this position recently. We have received your application and will review it soon.',
            },
            { status: 409 }
          );
        }
      } catch (redisErr) {
        console.warn('Redis dedup check error (proceeding):', redisErr);
      }
    }

    // Resume extension allowlist
    const loweredFileName = resumeFileName.trim().toLowerCase();
    const extension = loweredFileName.slice(loweredFileName.lastIndexOf('.'));
    if (!ALLOWED_RESUME_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error: 'Unsupported resume format',
          details: `Resume must be one of: ${ALLOWED_RESUME_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Convert base64 resume to Buffer for attachment
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
      return NextResponse.json(
        {
          error: 'Failed to process resume file',
          details: error instanceof Error ? error.message : 'Invalid file format',
        },
        { status: 400 }
      );
    }

    // Decoded-size cap — matches the client-side 5 MB limit
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

    const emailHtml = buildAdminEmail(data, resumeFileName, resumeBuffer.length);

    // Send email with attachment
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

    // Record deduplication key after successful email dispatch
    if (redis) {
      try {
        await redis.set(dedupKey, '1', { ex: 86400 });
      } catch (redisErr) {
        console.warn('Redis dedup set error:', redisErr);
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

    return NextResponse.json(
      { message: 'Application submitted successfully!' },
      { status: 200 }
    );
  } catch (e) {
    console.error('Career application error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';

    // Check if it's a Nodemailer specific error or timeout
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT') {
        return NextResponse.json(
          {
            error:
              'Failed to connect to SMTP server. Please try again later or check server configuration.',
            details: errorMessage,
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to submit application', details: errorMessage },
      { status: 500 }
    );
  }
}
