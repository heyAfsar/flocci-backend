-- ============================================================================
-- Careers: authenticated applications, one open application per candidate,
-- and a real status timeline the candidate can track on the dashboard.
--
-- Target DB: flocci_app_official (VPS Postgres, reached via the pgbouncer door)
-- Idempotent: safe to re-run.
--
-- Why a NEW table instead of the existing `job_applications`:
--   `job_applications.job_id` is a uuid FK into `job_listings`, but Flocci's
--   openings are a static catalog (`src/data/careers.mjs`) keyed by an integer
--   id + slug. `job_listings` is empty, `job_applications` is empty, and the
--   old shape cannot hold the multi-step application (links, education,
--   availability, screening answers). The legacy tables are left untouched.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_applications (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity: the application belongs to a signed-in Flocci profile, not to
    -- a typed-in email. This is what makes the one-open-application rule real.
    profile_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Human-quotable handle, e.g. FLC-8K2M-7QD3.
    reference_code    varchar(24) NOT NULL UNIQUE,

    -- Job identity, denormalised from the static catalog so an application
    -- still reads correctly after a posting is edited or retired.
    job_id            integer NOT NULL,
    job_slug          varchar(200),
    job_title         varchar(300) NOT NULL,
    job_track         varchar(200),
    product_team      varchar(200),
    company_name      varchar(200) NOT NULL,
    job_type          varchar(120),
    location          varchar(200),
    is_remote         boolean DEFAULT false,

    -- Candidate contact (name/email mirrored from the profile at submit time)
    candidate_name    varchar(200) NOT NULL,
    candidate_email   varchar(255) NOT NULL,
    phone             varchar(40),

    -- Structured blocks, stored as submitted
    links             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- linkedin/github/portfolio/work[]
    education         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- institution/degree/branch/year/score/city
    availability      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- earliestStart/hoursPerWeek/college-mandate
    answers           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{id,question,answer}]
    required_skills   text[] DEFAULT '{}',
    cover_letter      text,
    meta              jsonb NOT NULL DEFAULT '{}'::jsonb,   -- source/pageUrl/submittedAt/userAgent

    -- Lifecycle
    --   OPEN      : submitted, under_review, shortlisted, interview, offer
    --   CLOSED-ok : hired      (blocks re-application — they're in)
    --   CLOSED    : rejected, withdrawn  (unblocks re-application)
    status            varchar(30) NOT NULL DEFAULT 'submitted',
    status_note       text,

    submitted_at      timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    decided_at        timestamptz,

    CONSTRAINT career_applications_status_check CHECK (status IN (
        'submitted', 'under_review', 'shortlisted', 'interview',
        'offer', 'hired', 'rejected', 'withdrawn'
    ))
);

-- THE RULE: one unresolved application per candidate, across every role.
-- A candidate may apply again only once the previous one is rejected or
-- withdrawn. Enforced in the database so no API path can bypass it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_applications_one_open
    ON career_applications (profile_id)
    WHERE status IN ('submitted', 'under_review', 'shortlisted', 'interview', 'offer', 'hired');

CREATE INDEX IF NOT EXISTS idx_career_applications_profile
    ON career_applications (profile_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_applications_status
    ON career_applications (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_applications_job
    ON career_applications (job_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_applications_email
    ON career_applications (lower(candidate_email));

-- ---------------------------------------------------------------------------
-- 2. Status timeline — what turns the dashboard from a status word into a story
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_application_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES career_applications(id) ON DELETE CASCADE,

    -- 'submitted' | 'status_change' | 'note' | 'withdrawn' | 'message'
    kind            varchar(40) NOT NULL,
    from_status     varchar(30),
    to_status       varchar(30),

    title           varchar(200) NOT NULL,
    body            text,

    -- who moved it: 'candidate' | 'system' | an admin email
    actor           varchar(255) NOT NULL DEFAULT 'system',
    -- internal reviewer notes stay off the candidate's timeline
    visible_to_candidate boolean NOT NULL DEFAULT true,

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_application_events_app
    ON career_application_events (application_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Resume blob, split out so list queries never drag megabytes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_application_resumes (
    application_id  uuid PRIMARY KEY REFERENCES career_applications(id) ON DELETE CASCADE,
    file_name       varchar(300) NOT NULL,
    content_type    varchar(120) NOT NULL DEFAULT 'application/octet-stream',
    size_bytes      integer NOT NULL,
    content         bytea NOT NULL,
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger (reuses the shared helper when present)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_career_application_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_career_applications_updated_at ON career_applications;
CREATE TRIGGER trg_career_applications_updated_at
    BEFORE UPDATE ON career_applications
    FOR EACH ROW EXECUTE FUNCTION set_career_application_updated_at();
