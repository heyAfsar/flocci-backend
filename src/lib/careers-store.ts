import { randomInt } from 'crypto';
import type { PoolClient } from 'pg';
import { pgQuery, withTransaction } from './pg-shim';

/**
 * Careers data-access + mapping layer. Every careers route (candidate and
 * admin) goes through here so nobody hand-rolls SQL twice and every response
 * shape matches `flocci-official-landing-page/src/lib/careers-api.ts` field
 * for field (camelCase on the wire, snake_case in the DB).
 */

/* -------------------------------------------------------------------------- */
/* Lifecycle model — mirrors the DB CHECK constraint and the partial unique   */
/* index (sql/career_applications.sql). Keep these two lists in lock-step     */
/* with that file if the schema ever changes.                                */
/* -------------------------------------------------------------------------- */

export const APPLICATION_STATUSES = [
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Statuses that block a new application — mirrors uq_career_applications_one_open. */
export const BLOCKING_STATUSES: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'offer',
  'hired',
];

/** Statuses that represent a final decision — this is when decided_at is stamped. */
const TERMINAL_STATUSES: ApplicationStatus[] = ['hired', 'rejected', 'withdrawn'];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Joined',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

export const isOpenStatus = (status: string): boolean =>
  (BLOCKING_STATUSES as string[]).includes(status);

export const isValidStatus = (status: string): status is ApplicationStatus =>
  (APPLICATION_STATUSES as readonly string[]).includes(status);

/* -------------------------------------------------------------------------- */
/* Errors — routes translate these into the right HTTP status.                */
/* -------------------------------------------------------------------------- */

export class OpenApplicationExistsError extends Error {
  constructor() {
    super('An open application already exists for this candidate');
    this.name = 'OpenApplicationExistsError';
  }
}

export class ApplicationNotFoundError extends Error {
  constructor() {
    super('Application not found');
    this.name = 'ApplicationNotFoundError';
  }
}

export class ApplicationNotOpenError extends Error {
  status: string;
  constructor(status: string) {
    super(`Application is not open (status=${status})`);
    this.name = 'ApplicationNotOpenError';
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Row shapes (snake_case, straight off Postgres)                             */
/* -------------------------------------------------------------------------- */

export interface ApplicationRow {
  id: string;
  profile_id: string;
  reference_code: string;
  job_id: number;
  job_slug: string | null;
  job_title: string;
  job_track: string | null;
  product_team: string | null;
  company_name: string;
  job_type: string | null;
  location: string | null;
  is_remote: boolean;
  candidate_name: string;
  candidate_email: string;
  phone: string | null;
  links: Record<string, unknown> | null;
  education: Record<string, unknown> | null;
  availability: Record<string, unknown> | null;
  answers: Array<{ id?: string; question: string; answer: string }> | null;
  required_skills: string[] | null;
  cover_letter: string | null;
  meta: Record<string, unknown> | null;
  status: string;
  status_note: string | null;
  submitted_at: string | Date;
  updated_at: string | Date;
  decided_at: string | Date | null;
}

export interface AdminApplicationRowRaw extends ApplicationRow {
  has_resume: boolean;
}

export interface EventRow {
  id: string;
  application_id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  title: string;
  body: string | null;
  actor: string;
  visible_to_candidate: boolean;
  created_at: string | Date;
}

export interface ResumeMetaRow {
  application_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string | Date;
}

export interface ResumeContentRow {
  file_name: string;
  content_type: string;
  content: Buffer;
}

/* -------------------------------------------------------------------------- */
/* Wire shapes — must match careers-api.ts exactly                            */
/* -------------------------------------------------------------------------- */

export interface ApplicationSummary {
  id: string;
  referenceCode: string;
  jobId: number;
  jobSlug: string | null;
  jobTitle: string;
  jobTrack: string | null;
  productTeam: string | null;
  companyName: string;
  location: string | null;
  isRemote: boolean;
  status: ApplicationStatus;
  statusNote: string | null;
  submittedAt: string;
  updatedAt: string;
  decidedAt: string | null;
  isOpen: boolean;
}

export interface TimelineEvent {
  id: string;
  kind: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  title: string;
  body: string | null;
  actor: string;
  createdAt: string;
  /**
   * False only on internal reviewer notes. Admin and panel surfaces receive
   * these alongside the candidate timeline and must mark them; the candidate
   * query filters them out server-side, so this is always true on that path.
   */
  visibleToCandidate: boolean;
}

export interface ApplicationDetail extends ApplicationSummary {
  candidateName: string;
  candidateEmail: string;
  phone: string | null;
  links: Record<string, unknown>;
  education: Record<string, unknown>;
  availability: Record<string, unknown>;
  answers: Array<{ id?: string; question: string; answer: string }>;
  requiredSkills: string[];
  coverLetter: string | null;
  resume: { fileName: string; sizeBytes: number; contentType: string } | null;
  events: TimelineEvent[];
}

export interface AdminApplicationRow extends ApplicationSummary {
  candidateName: string;
  candidateEmail: string;
  phone: string | null;
  institution: string | null;
  hasResume: boolean;
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

const iso = (v: string | Date | null | undefined): string | null => {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
};

export function mapSummary(row: ApplicationRow): ApplicationSummary {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    jobId: row.job_id,
    jobSlug: row.job_slug,
    jobTitle: row.job_title,
    jobTrack: row.job_track,
    productTeam: row.product_team,
    companyName: row.company_name,
    location: row.location,
    isRemote: Boolean(row.is_remote),
    status: row.status as ApplicationStatus,
    statusNote: row.status_note,
    submittedAt: iso(row.submitted_at) as string,
    updatedAt: iso(row.updated_at) as string,
    decidedAt: iso(row.decided_at),
    isOpen: isOpenStatus(row.status),
  };
}

export function mapEvent(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    kind: row.kind,
    fromStatus: (row.from_status as ApplicationStatus | null) ?? null,
    toStatus: (row.to_status as ApplicationStatus | null) ?? null,
    title: row.title,
    body: row.body,
    actor: row.actor,
    createdAt: iso(row.created_at) as string,
    // Admin/panel surfaces receive internal reviewer notes alongside the
    // candidate-visible timeline and MUST be able to tell them apart before
    // rendering. The candidate query filters to visible_to_candidate = true
    // upstream, so this is always true on that path — never a leak, just an
    // explicit flag instead of making the reader guess from `kind`.
    visibleToCandidate: row.visible_to_candidate !== false,
  };
}

export function mapDetail(
  row: ApplicationRow,
  events: EventRow[],
  resume: ResumeMetaRow | null,
): ApplicationDetail {
  return {
    ...mapSummary(row),
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    phone: row.phone,
    links: row.links || {},
    education: row.education || {},
    availability: row.availability || {},
    answers: row.answers || [],
    requiredSkills: row.required_skills || [],
    coverLetter: row.cover_letter,
    resume: resume
      ? { fileName: resume.file_name, sizeBytes: resume.size_bytes, contentType: resume.content_type }
      : null,
    events: events.map(mapEvent),
  };
}

export function mapAdminRow(row: AdminApplicationRowRaw): AdminApplicationRow {
  const institution =
    row.education && typeof row.education === 'object' && 'institution' in row.education
      ? ((row.education as Record<string, unknown>).institution as string | undefined) ?? null
      : null;
  return {
    ...mapSummary(row),
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    phone: row.phone,
    institution,
    hasResume: Boolean(row.has_resume),
  };
}

/* -------------------------------------------------------------------------- */
/* Reference code — human-quotable handle, e.g. FLC-8K2M-7QD3                 */
/* -------------------------------------------------------------------------- */

// No ambiguous glyphs: I/O/0/1 excluded.
const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomSegment(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return out;
}

export function generateReferenceCode(): string {
  return `FLC-${randomSegment(4)}-${randomSegment(4)}`;
}

/* -------------------------------------------------------------------------- */
/* Query helper — runs on a transaction client when given, else the pool.     */
/* -------------------------------------------------------------------------- */

async function run<T = Record<string, unknown>>(
  client: PoolClient | undefined,
  text: string,
  values?: unknown[],
): Promise<T[]> {
  if (client) {
    const res = await client.query(text, values as never[]);
    return res.rows as T[];
  }
  return pgQuery<T>(text, values);
}

/* -------------------------------------------------------------------------- */
/* Candidate reads                                                            */
/* -------------------------------------------------------------------------- */

export async function getOpenApplication(profileId: string): Promise<ApplicationSummary | null> {
  const rows = await pgQuery<ApplicationRow>(
    `SELECT * FROM career_applications
     WHERE profile_id = $1 AND status = ANY($2::text[])
     ORDER BY submitted_at DESC LIMIT 1`,
    [profileId, BLOCKING_STATUSES],
  );
  return rows[0] ? mapSummary(rows[0]) : null;
}

export async function listApplications(profileId: string): Promise<ApplicationSummary[]> {
  const rows = await pgQuery<ApplicationRow>(
    `SELECT * FROM career_applications WHERE profile_id = $1 ORDER BY submitted_at DESC`,
    [profileId],
  );
  return rows.map(mapSummary);
}

export async function getApplicationForOwner(
  id: string,
  profileId: string,
): Promise<{ row: ApplicationRow; events: EventRow[]; resume: ResumeMetaRow | null } | null> {
  const rows = await pgQuery<ApplicationRow>(
    `SELECT * FROM career_applications WHERE id = $1 AND profile_id = $2`,
    [id, profileId],
  );
  const row = rows[0];
  if (!row) return null;
  const events = await pgQuery<EventRow>(
    `SELECT * FROM career_application_events
     WHERE application_id = $1 AND visible_to_candidate = true
     ORDER BY created_at ASC`,
    [id],
  );
  const resumeRows = await pgQuery<ResumeMetaRow>(
    `SELECT application_id, file_name, content_type, size_bytes, uploaded_at
     FROM career_application_resumes WHERE application_id = $1`,
    [id],
  );
  return { row, events, resume: resumeRows[0] || null };
}

export async function getResumeForOwner(id: string, profileId: string): Promise<ResumeContentRow | null> {
  const owns = await pgQuery<{ id: string }>(
    `SELECT id FROM career_applications WHERE id = $1 AND profile_id = $2`,
    [id, profileId],
  );
  if (!owns[0]) return null;
  const rows = await pgQuery<ResumeContentRow>(
    `SELECT file_name, content_type, content FROM career_application_resumes WHERE application_id = $1`,
    [id],
  );
  return rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export async function appendEvent(
  client: PoolClient | undefined,
  input: {
    applicationId: string;
    kind: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    title: string;
    body?: string | null;
    actor: string;
    visibleToCandidate?: boolean;
  },
): Promise<EventRow> {
  const rows = await run<EventRow>(
    client,
    `INSERT INTO career_application_events
       (application_id, kind, from_status, to_status, title, body, actor, visible_to_candidate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      input.applicationId,
      input.kind,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.title,
      input.body ?? null,
      input.actor,
      input.visibleToCandidate ?? true,
    ],
  );
  return rows[0];
}

/* -------------------------------------------------------------------------- */
/* Submit — application + resume + "submitted" event, one transaction.        */
/* Retries on a reference-code collision; converts the one-open-application   */
/* partial-unique-index violation into a typed error the route turns into a   */
/* clean 409 (this is also the race-safety net — never let 23505 500).        */
/* -------------------------------------------------------------------------- */

export interface SubmitApplicationInput {
  profileId: string;
  jobId: number;
  jobSlug: string | null;
  jobTitle: string;
  jobTrack: string | null;
  productTeam: string | null;
  companyName: string;
  jobType: string | null;
  location: string | null;
  isRemote: boolean;
  candidateName: string;
  candidateEmail: string;
  phone: string | null;
  links: unknown;
  education: unknown;
  availability: unknown;
  answers: unknown;
  requiredSkills: string[];
  coverLetter: string | null;
  meta: unknown;
  resumeFileName: string;
  resumeContentType: string;
  resumeSizeBytes: number;
  resumeContent: Buffer;
}

export async function submitApplication(input: SubmitApplicationInput): Promise<ApplicationRow> {
  const MAX_ATTEMPTS = 5;
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const referenceCode = generateReferenceCode();
    try {
      return await withTransaction(async (client) => {
        const rows = await run<ApplicationRow>(
          client,
          `INSERT INTO career_applications (
             profile_id, reference_code, job_id, job_slug, job_title, job_track, product_team,
             company_name, job_type, location, is_remote, candidate_name, candidate_email, phone,
             links, education, availability, answers, required_skills, cover_letter, meta
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
           RETURNING *`,
          [
            input.profileId,
            referenceCode,
            input.jobId,
            input.jobSlug,
            input.jobTitle,
            input.jobTrack,
            input.productTeam,
            input.companyName,
            input.jobType,
            input.location,
            input.isRemote,
            input.candidateName,
            input.candidateEmail,
            input.phone,
            input.links ?? {},
            input.education ?? {},
            input.availability ?? {},
            input.answers ?? [],
            input.requiredSkills ?? [],
            input.coverLetter,
            input.meta ?? {},
          ],
        );
        const applicationRow = rows[0];

        await run(
          client,
          `INSERT INTO career_application_resumes (application_id, file_name, content_type, size_bytes, content)
           VALUES ($1,$2,$3,$4,$5)`,
          [applicationRow.id, input.resumeFileName, input.resumeContentType, input.resumeSizeBytes, input.resumeContent],
        );

        await appendEvent(client, {
          applicationId: applicationRow.id,
          kind: 'submitted',
          toStatus: 'submitted',
          title: 'Application submitted',
          actor: 'candidate',
          visibleToCandidate: true,
        });

        return applicationRow;
      });
    } catch (e) {
      const err = e as { code?: string; constraint?: string };
      if (err?.code === '23505') {
        if (err.constraint === 'uq_career_applications_one_open') {
          throw new OpenApplicationExistsError();
        }
        // Reference-code collision (astronomically unlikely) — try a fresh code.
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to generate a unique reference code');
}

/* -------------------------------------------------------------------------- */
/* Import — replay a historical application that only ever existed as email.  */
/*                                                                            */
/* Same table, same events, same one-open-application rule as submitApplication */
/* — the ONLY differences are that every timestamp is the real historical one */
/* instead of now(), the row may land in a closed status, and no mail is sent */
/* (these candidates were already emailed the day they applied).              */
/* -------------------------------------------------------------------------- */

/** Statuses an import may create. Anything else belongs to the admin update path. */
export const IMPORTABLE_STATUSES = ['submitted', 'withdrawn', 'rejected'] as const;
export type ImportableStatus = (typeof IMPORTABLE_STATUSES)[number];

export interface ImportApplicationInput
  extends Omit<
    SubmitApplicationInput,
    'resumeFileName' | 'resumeContentType' | 'resumeSizeBytes' | 'resumeContent'
  > {
  /** The real historical submission time — becomes submitted_at AND updated_at. */
  submittedAt: string;
  status: ImportableStatus;
  /** Event body for the closing event on a non-`submitted` import. */
  closingReason?: string | null;
  /** Historical emails usually carry the resume; a few may not. */
  resumeFileName?: string | null;
  resumeContentType?: string | null;
  resumeSizeBytes?: number | null;
  resumeContent?: Buffer | null;
}

/**
 * Find a previously imported row for the dedupe key `(profile_id, job_id,
 * submitted_at)`. Re-running the importer must never duplicate a candidate.
 */
export async function findImportedApplication(
  profileId: string,
  jobId: number,
  submittedAt: string,
): Promise<ApplicationRow | null> {
  const rows = await pgQuery<ApplicationRow>(
    `SELECT * FROM career_applications
     WHERE profile_id = $1 AND job_id = $2 AND submitted_at = $3::timestamptz
     LIMIT 1`,
    [profileId, jobId, submittedAt],
  );
  return rows[0] || null;
}

/**
 * Resolve a profile by lowercased email, creating a detached one when absent.
 *
 * The created profile deliberately has `identity_user_id = NULL`. `ensureProfile`
 * links an existing by-email profile to the identity on first Google login, so
 * an imported profile silently BECOMES the real user's the moment they sign in.
 * Never invent a fake identity id here — that would permanently orphan the row.
 */
export async function resolveOrCreateProfileByEmail(
  email: string,
  fullName: string,
): Promise<{ id: string; created: boolean }> {
  const lowered = email.trim().toLowerCase();

  const existing = await pgQuery<{ id: string }>(
    `SELECT id FROM profiles WHERE lower(email) = $1 LIMIT 1`,
    [lowered],
  );
  if (existing[0]) return { id: existing[0].id, created: false };

  // No ON CONFLICT clause on purpose: it would have to name a constraint, and
  // this must work against the live profiles table regardless of how its email
  // uniqueness is spelled. A duplicate-key race is caught and re-read instead.
  try {
    const inserted = await pgQuery<{ id: string }>(
      `INSERT INTO profiles (identity_user_id, email, full_name, role)
       VALUES (NULL, $1, $2, 'user')
       RETURNING id`,
      [lowered, fullName],
    );
    if (inserted[0]) return { id: inserted[0].id, created: true };
  } catch (e) {
    if ((e as { code?: string })?.code !== '23505') throw e;
  }

  const again = await pgQuery<{ id: string }>(
    `SELECT id FROM profiles WHERE lower(email) = $1 LIMIT 1`,
    [lowered],
  );
  if (!again[0]) throw new Error(`Failed to resolve or create a profile for ${lowered}`);
  return { id: again[0].id, created: false };
}

export async function importApplication(input: ImportApplicationInput): Promise<ApplicationRow> {
  const MAX_ATTEMPTS = 5;
  let lastErr: unknown;

  const terminal = TERMINAL_STATUSES.includes(input.status);
  // The closing event must sort AFTER the submitted event on `created_at ASC`,
  // even though both belong to the same historical instant.
  const closedAt = new Date(new Date(input.submittedAt).getTime() + 1000).toISOString();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const referenceCode = generateReferenceCode();
    try {
      return await withTransaction(async (client) => {
        const rows = await run<ApplicationRow>(
          client,
          `INSERT INTO career_applications (
             profile_id, reference_code, job_id, job_slug, job_title, job_track, product_team,
             company_name, job_type, location, is_remote, candidate_name, candidate_email, phone,
             links, education, availability, answers, required_skills, cover_letter, meta,
             status, submitted_at, updated_at, decided_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
             $22,$23::timestamptz,$23::timestamptz,$24
           )
           RETURNING *`,
          [
            input.profileId,
            referenceCode,
            input.jobId,
            input.jobSlug,
            input.jobTitle,
            input.jobTrack,
            input.productTeam,
            input.companyName,
            input.jobType,
            input.location,
            input.isRemote,
            input.candidateName,
            input.candidateEmail,
            input.phone,
            input.links ?? {},
            input.education ?? {},
            input.availability ?? {},
            input.answers ?? [],
            input.requiredSkills ?? [],
            input.coverLetter,
            input.meta ?? {},
            input.status,
            input.submittedAt,
            terminal ? closedAt : null,
          ],
        );
        const applicationRow = rows[0];

        if (input.resumeContent && input.resumeFileName) {
          await run(
            client,
            `INSERT INTO career_application_resumes (application_id, file_name, content_type, size_bytes, content, uploaded_at)
             VALUES ($1,$2,$3,$4,$5,$6::timestamptz)`,
            [
              applicationRow.id,
              input.resumeFileName,
              input.resumeContentType || contentTypeForFile(input.resumeFileName),
              input.resumeSizeBytes ?? input.resumeContent.length,
              input.resumeContent,
              input.submittedAt,
            ],
          );
        }

        // The submitted event always happened — stamp it at the real date so the
        // candidate's timeline reads as the history it actually is.
        await run(
          client,
          `INSERT INTO career_application_events
             (application_id, kind, from_status, to_status, title, body, actor, visible_to_candidate, created_at)
           VALUES ($1,'submitted',NULL,'submitted','Application submitted',NULL,'candidate',true,$2::timestamptz)`,
          [applicationRow.id, input.submittedAt],
        );

        if (input.status !== 'submitted') {
          const isWithdrawn = input.status === 'withdrawn';
          await run(
            client,
            `INSERT INTO career_application_events
               (application_id, kind, from_status, to_status, title, body, actor, visible_to_candidate, created_at)
             VALUES ($1,$2,'submitted',$3,$4,$5,'import',true,$6::timestamptz)`,
            [
              applicationRow.id,
              isWithdrawn ? 'withdrawn' : 'status_change',
              input.status,
              isWithdrawn ? 'Application withdrawn' : `Status changed to ${STATUS_LABEL[input.status]}`,
              input.closingReason && input.closingReason.trim() ? input.closingReason.trim() : null,
              closedAt,
            ],
          );
        }

        return applicationRow;
      });
    } catch (e) {
      const err = e as { code?: string; constraint?: string };
      if (err?.code === '23505') {
        if (err.constraint === 'uq_career_applications_one_open') {
          throw new OpenApplicationExistsError();
        }
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to generate a unique reference code');
}

/* -------------------------------------------------------------------------- */
/* Withdraw (candidate)                                                       */
/* -------------------------------------------------------------------------- */

export async function withdrawApplication(
  id: string,
  profileId: string,
  reason?: string,
): Promise<ApplicationRow> {
  return withTransaction(async (client) => {
    const rows = await run<ApplicationRow>(
      client,
      `SELECT * FROM career_applications WHERE id = $1 AND profile_id = $2 FOR UPDATE`,
      [id, profileId],
    );
    const existing = rows[0];
    if (!existing) throw new ApplicationNotFoundError();
    if (!isOpenStatus(existing.status)) throw new ApplicationNotOpenError(existing.status);

    const updated = await run<ApplicationRow>(
      client,
      `UPDATE career_applications SET status = 'withdrawn', decided_at = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    await appendEvent(client, {
      applicationId: id,
      kind: 'withdrawn',
      fromStatus: existing.status,
      toStatus: 'withdrawn',
      title: 'Application withdrawn',
      body: reason && reason.trim() ? reason.trim() : null,
      actor: 'candidate',
      visibleToCandidate: true,
    });
    return updated[0];
  });
}

/* -------------------------------------------------------------------------- */
/* Admin reads                                                                */
/* -------------------------------------------------------------------------- */

export interface AdminListParams {
  status?: string;
  jobId?: number;
  q?: string;
  limit: number;
  offset: number;
}

export async function listApplicationsAdmin(
  params: AdminListParams,
): Promise<{ rows: AdminApplicationRowRaw[]; total: number; stats: Partial<Record<ApplicationStatus, number>> }> {
  const where: string[] = [];
  const values: unknown[] = [];
  const addParam = (v: unknown) => {
    values.push(v);
    return `$${values.length}`;
  };

  if (params.status) where.push(`a.status = ${addParam(params.status)}`);
  if (params.jobId !== undefined) where.push(`a.job_id = ${addParam(params.jobId)}`);
  if (params.q) {
    const like = `%${params.q}%`;
    where.push(
      `(a.candidate_name ILIKE ${addParam(like)} OR a.candidate_email ILIKE ${addParam(like)} OR a.reference_code ILIKE ${addParam(like)})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const listValues = [...values];
  listValues.push(params.limit);
  const limitPh = `$${listValues.length}`;
  listValues.push(params.offset);
  const offsetPh = `$${listValues.length}`;

  const rows = await pgQuery<AdminApplicationRowRaw>(
    `SELECT a.*, (r.application_id IS NOT NULL) AS has_resume
     FROM career_applications a
     LEFT JOIN career_application_resumes r ON r.application_id = a.id
     ${whereSql}
     ORDER BY a.submitted_at DESC
     LIMIT ${limitPh} OFFSET ${offsetPh}`,
    listValues,
  );

  const totalRows = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM career_applications a ${whereSql}`,
    values,
  );
  const total = Number(totalRows[0]?.count || 0);

  // Per-status counts over the WHOLE table — not the filtered/paginated slice.
  const statsRows = await pgQuery<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM career_applications GROUP BY status`,
  );
  const stats: Partial<Record<ApplicationStatus, number>> = {};
  for (const r of statsRows) {
    if (isValidStatus(r.status)) stats[r.status] = Number(r.count);
  }

  return { rows, total, stats };
}

export async function getApplicationAdmin(
  id: string,
): Promise<{ row: ApplicationRow; events: EventRow[]; resume: ResumeMetaRow | null } | null> {
  const rows = await pgQuery<ApplicationRow>(`SELECT * FROM career_applications WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const events = await pgQuery<EventRow>(
    `SELECT * FROM career_application_events WHERE application_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  const resumeRows = await pgQuery<ResumeMetaRow>(
    `SELECT application_id, file_name, content_type, size_bytes, uploaded_at
     FROM career_application_resumes WHERE application_id = $1`,
    [id],
  );
  return { row, events, resume: resumeRows[0] || null };
}

export async function getResumeAdmin(id: string): Promise<ResumeContentRow | null> {
  const rows = await pgQuery<ResumeContentRow>(
    `SELECT file_name, content_type, content FROM career_application_resumes WHERE application_id = $1`,
    [id],
  );
  return rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* Admin update                                                               */
/* -------------------------------------------------------------------------- */

export interface AdminUpdateInput {
  status?: ApplicationStatus;
  note?: string;
  internalNote?: string;
  actor: string;
}

export async function updateApplicationAdmin(id: string, input: AdminUpdateInput): Promise<ApplicationRow | null> {
  return withTransaction(async (client) => {
    const rows = await run<ApplicationRow>(client, `SELECT * FROM career_applications WHERE id = $1 FOR UPDATE`, [id]);
    const existing = rows[0];
    if (!existing) return null;

    let current = existing;

    if (input.status && input.status !== existing.status) {
      const terminal = TERMINAL_STATUSES.includes(input.status);
      const setSql = [`status = $2`, `updated_at = now()`];
      const vals: unknown[] = [id, input.status];
      if (input.note !== undefined) {
        vals.push(input.note);
        setSql.push(`status_note = $${vals.length}`);
      }
      if (terminal) setSql.push(`decided_at = now()`);
      const updated = await run<ApplicationRow>(
        client,
        `UPDATE career_applications SET ${setSql.join(', ')} WHERE id = $1 RETURNING *`,
        vals,
      );
      current = updated[0];
      await appendEvent(client, {
        applicationId: id,
        kind: 'status_change',
        fromStatus: existing.status,
        toStatus: input.status,
        title: `Status changed to ${STATUS_LABEL[input.status]}`,
        body: input.note && input.note.trim() ? input.note.trim() : null,
        actor: input.actor,
        visibleToCandidate: true,
      });
    } else if (input.note !== undefined && input.note.trim()) {
      const updated = await run<ApplicationRow>(
        client,
        `UPDATE career_applications SET status_note = $2, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, input.note.trim()],
      );
      current = updated[0];
      await appendEvent(client, {
        applicationId: id,
        kind: 'note',
        title: 'Note added',
        body: input.note.trim(),
        actor: input.actor,
        visibleToCandidate: true,
      });
    }

    if (input.internalNote && input.internalNote.trim()) {
      await appendEvent(client, {
        applicationId: id,
        kind: 'note',
        title: 'Internal note',
        body: input.internalNote.trim(),
        actor: input.actor,
        visibleToCandidate: false,
      });
    }

    return current;
  });
}

/* -------------------------------------------------------------------------- */
/* Admin summary — executive aggregate for the control-plane panel's         */
/* careers overview. Real SQL aggregation only — never pull whole tables     */
/* into JS to count them.                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminSummaryByJob {
  jobId: number;
  jobTitle: string;
  total: number;
  open: number;
}

export interface AdminSummaryRecent {
  id: string;
  referenceCode: string;
  candidateName: string;
  jobTitle: string;
  status: ApplicationStatus;
  submittedAt: string;
}

export interface AdminSummaryDay {
  date: string;
  count: number;
}

export interface AdminApplicationsSummary {
  total: number;
  open: number;
  byStatus: Partial<Record<ApplicationStatus, number>>;
  byJob: AdminSummaryByJob[];
  recent: AdminSummaryRecent[];
  last7Days: AdminSummaryDay[];
}

export async function getApplicationsSummaryAdmin(): Promise<AdminApplicationsSummary> {
  const [totalRows, byStatusRows, byJobRows, recentRows, last7Rows] = await Promise.all([
    pgQuery<{ count: string }>(`SELECT COUNT(*)::text AS count FROM career_applications`),

    pgQuery<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM career_applications GROUP BY status`,
    ),

    pgQuery<{ job_id: number; job_title: string; total: string; open: string }>(
      `SELECT job_id,
              MAX(job_title) AS job_title,
              COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = ANY($1::text[]))::text AS open
       FROM career_applications
       GROUP BY job_id
       ORDER BY COUNT(*) DESC`,
      [BLOCKING_STATUSES],
    ),

    pgQuery<{
      id: string;
      reference_code: string;
      candidate_name: string;
      job_title: string;
      status: string;
      submitted_at: string | Date;
    }>(
      `SELECT id, reference_code, candidate_name, job_title, status, submitted_at
       FROM career_applications
       ORDER BY submitted_at DESC
       LIMIT 10`,
    ),

    // One row per of the last 7 calendar days (server timezone), zero-filled
    // via generate_series so quiet days show 0 rather than being absent.
    pgQuery<{ date: string; count: string }>(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
              COALESCE(c.count, 0)::text AS count
       FROM generate_series((CURRENT_DATE - INTERVAL '6 days')::date, CURRENT_DATE::date, INTERVAL '1 day') AS d
       LEFT JOIN (
         SELECT date_trunc('day', submitted_at)::date AS day, COUNT(*) AS count
         FROM career_applications
         WHERE submitted_at >= CURRENT_DATE - INTERVAL '6 days'
         GROUP BY date_trunc('day', submitted_at)::date
       ) c ON c.day = d::date
       ORDER BY d`,
    ),
  ]);

  const total = Number(totalRows[0]?.count || 0);

  const byStatus: Partial<Record<ApplicationStatus, number>> = {};
  let open = 0;
  for (const r of byStatusRows) {
    if (isValidStatus(r.status)) {
      const n = Number(r.count);
      byStatus[r.status] = n;
      if (isOpenStatus(r.status)) open += n;
    }
  }

  const byJob: AdminSummaryByJob[] = byJobRows.map((r) => ({
    jobId: r.job_id,
    jobTitle: r.job_title,
    total: Number(r.total),
    open: Number(r.open),
  }));

  const recent: AdminSummaryRecent[] = recentRows.map((r) => ({
    id: r.id,
    referenceCode: r.reference_code,
    candidateName: r.candidate_name,
    jobTitle: r.job_title,
    status: r.status as ApplicationStatus,
    submittedAt: iso(r.submitted_at) as string,
  }));

  const last7Days: AdminSummaryDay[] = last7Rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  return { total, open, byStatus, byJob, recent, last7Days };
}

/* -------------------------------------------------------------------------- */
/* Resume content-type from filename extension                               */
/* -------------------------------------------------------------------------- */

export function contentTypeForFile(fileName: string): string {
  const lowered = fileName.trim().toLowerCase();
  const ext = lowered.slice(lowered.lastIndexOf('.'));
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}
