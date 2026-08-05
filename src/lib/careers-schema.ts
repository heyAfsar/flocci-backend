import { z } from 'zod';

/**
 * The single career-application payload contract.
 *
 * This lives in `lib/` rather than inside `app/api/careers/route.ts` because
 * Next.js App Router validates the exports of a `route.ts` file and rejects
 * anything that is not an HTTP method or a recognised route config field — so
 * the schema cannot be re-exported from the route itself. Both the live
 * candidate route (`/api/careers`) and the historical importer
 * (`/api/admin/careers/import`) import it from here, so there is exactly ONE
 * definition of what an application looks like.
 */

// Resume hardening — mirrors the client-side limits.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB decoded
export const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const MAX_URL_LENGTH = 500;
const MAX_WORK_LINKS = 10;

/** Blank-ish strings behave as "not provided" so we never render empty rows. */
const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/** Optional trimmed text that collapses blanks to `undefined`. */
export const optionalText = (max: number) =>
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

export const careerApplicationSchema = z.object({
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

export type CareerApplication = z.infer<typeof careerApplicationSchema>;
