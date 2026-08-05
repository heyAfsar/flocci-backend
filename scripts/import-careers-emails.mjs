#!/usr/bin/env node
/**
 * ============================================================================
 * Historical careers importer — replays job applications that exist ONLY as
 * email back into the careers database.
 * ============================================================================
 *
 * WHY THIS EXISTS
 *   Before 2026-08-05 `POST /api/careers` only built an HTML email and sent it
 *   with the resume attached. It wrote to no table, so `career_applications`
 *   has zero rows and every application received before that date survives
 *   only as a message in the team mailbox under `[Gmail]/Sent Mail`, subject
 *   prefixed `New Job Application from`.
 *
 * WHAT IT DOES
 *   IMAP search  ->  fetch  ->  parse the machine-generated admin email back
 *   into the exact `ApplicationPayload` shape  ->  pull the resume out of the
 *   MIME attachment  ->  map the posting back to its jobId/jobSlug  ->  group
 *   by candidate  ->  POST each one to `/api/admin/careers/import`, which is
 *   the SAME validated contract a live application goes through.
 *
 *   The email body is machine-generated with a fixed structure (see
 *   `buildAdminEmail()` in src/app/api/careers/route.ts), so it is parsed
 *   STRUCTURALLY — anchored on the exact inline style strings that function
 *   emits — never with fuzzy regex over prose.
 *
 * PER-CANDIDATE RULE
 *   The database enforces one open application per candidate across every
 *   role. So for each candidate the EARLIEST application is imported as
 *   `submitted` and every later one as `withdrawn`, with a reason explaining
 *   it was superseded. The dashboard then shows one in-progress application
 *   and the rest cancelled, which is the truth.
 *
 * SAFETY
 *   - Dry run is the DEFAULT. Writing requires an explicit `--commit`.
 *   - The import endpoint is idempotent on (profile, job, submittedAt), so a
 *     re-run never duplicates.
 *   - No email of any kind is sent — these people were already emailed when
 *     they applied.
 *   - Secrets are never printed. Resume bytes are never printed or dumped.
 *
 * USAGE
 *   node scripts/import-careers-emails.mjs --since=01-Aug-2026 --dry-run
 *   node scripts/import-careers-emails.mjs --since=01-Aug-2026 --out=plan.json
 *   node scripts/import-careers-emails.mjs --since=01-Aug-2026 --commit
 *
 * ENV (names only — values live in .env and are never echoed)
 *   SMTP_USER, SMTP_PASS            mailbox + app password (IMAP works with
 *                                   the existing Gmail app password)
 *   OFFICIAL_ADMIN_SERVICE_KEY      service-key auth for the import endpoint
 *   APP_URL                         default API base for --commit
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// .env.local first so it wins (dotenv never overwrites an already-set key).
dotenv.config({ path: path.join(REPO_ROOT, '.env.local') });
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

/* ==========================================================================
 * HUMAN OVERRIDE MAPS — both EMPTY by default, ON PURPOSE.
 *
 * These encode DECISIONS ABOUT REAL PEOPLE. Nothing here may be guessed by a
 * script or by an assistant: a wrong entry silently attaches one person's
 * application history to another person's account. Fill them in only from a
 * human decision, then re-run the dry run and read the plan before committing.
 * ========================================================================== */

/**
 * Mistyped address -> corrected address.
 * Applied to the identity used for the profile, so the corrected address is
 * what the candidate will later sign in with. The address as typed is still
 * preserved on the application (`submittedFromEmail`).
 *
 * Every entry here is a HUMAN decision — never infer one. Correcting an
 * identity address wrongly sends someone's application details to a stranger.
 */
const EMAIL_CORRECTIONS = {
  // Cohort 2. She typed "gmali", so she never received her acknowledgement and
  // could never sign in to see the application. Founder-approved 2026-08-05.
  'gayatrinanaware3@gmali.com': 'gayatrinanaware3@gmail.com',
};

/**
 * Secondary address -> primary address.
 * One human who applied under two addresses becomes ONE candidate: the
 * first-application rule spans both, AND the applications all land on the
 * primary profile so their dashboard shows one complete history.
 */
const IDENTITY_MERGES = {
  // Cohort 2. Verified same person before merging, not assumed: identical name
  // (Anjali Pradeep Prasad), identical phone, identical institution
  // (Savitribai Phule Pune University), programme, city, graduation year and
  // résumé file across all five applications. ...9545 is primary because it is
  // the address that already had a profile row. Founder-approved 2026-08-05.
  'anjaliprasad9581@gmail.com': 'anjaliprasad9545@gmail.com',
};

/** Addresses to exclude entirely — internal accounts, test submissions. */
const SKIP_EMAILS = [
  'afsar.s33@gmail.com', // founder's own test application
  'aliya26firdous@gmail.com', // internal
];

/* ==========================================================================
 * Constants
 * ========================================================================== */

const SUBJECT_PREFIX = 'New Job Application from';
const DEFAULT_MAILBOX = '[Gmail]/Sent Mail';
const IMAP_HOST = 'imap.gmail.com';
const IMAP_PORT = 993;

/** Candidate-facing. Appears on their dashboard timeline — keep it human. */
const SUPERSEDED_REASON =
  'Closed while we brought the careers records into the new application tracker. ' +
  'You applied more than once, and only one application can stay open at a time, ' +
  'so your earliest application is the one being reviewed.';

/* The exact inline styles `buildAdminEmail()` emits. These are the anchors the
 * parser keys on — if that function ever changes, these must change with it. */
const LABEL_CELL =
  'padding:6px 14px 6px 0;vertical-align:top;font:600 13px/1.5 Arial,Helvetica,sans-serif;color:#555555;white-space:nowrap;';
const VALUE_CELL =
  'padding:6px 0;vertical-align:top;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#111111;';
const SECTION_TITLE_STYLE =
  'font:700 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#7a7a7a;padding-bottom:8px;border-bottom:1px solid #e6e6e6;';
const TEXTBLOCK_HEADING_STYLE = 'font:700 14px/1.5 Arial,Helvetica,sans-serif;color:#111111;';
const TEXTBLOCK_BODY_STYLE =
  'font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#333333;padding:4px 0 10px 0;';
const PARAGRAPH_BLOCK_STYLE =
  'padding:2px 0 4px 0;font:400 14px/1.65 Arial,Helvetica,sans-serif;color:#333333;';

const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

/* ==========================================================================
 * CLI
 * ========================================================================== */

function parseArgs(argv) {
  const opts = {
    since: null,
    before: null,
    commit: false,
    limit: null,
    out: null,
    mailbox: DEFAULT_MAILBOX,
    api: (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  };
  for (const arg of argv) {
    const [rawKey, ...rest] = arg.split('=');
    const value = rest.join('=');
    switch (rawKey) {
      case '--since':
        opts.since = parseCliDate(value, '--since');
        break;
      case '--before':
        opts.before = parseCliDate(value, '--before');
        break;
      case '--dry-run':
        opts.commit = false;
        break;
      case '--commit':
        opts.commit = true;
        break;
      case '--limit':
        opts.limit = Number(value);
        if (!Number.isFinite(opts.limit) || opts.limit < 1) fail(`--limit must be a positive number`);
        break;
      case '--out':
        opts.out = value;
        break;
      case '--mailbox':
        opts.mailbox = value;
        break;
      case '--api':
        opts.api = value.replace(/\/+$/, '');
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`Unknown flag: ${rawKey}. Run with --help.`);
    }
  }
  return opts;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Accepts the IMAP form `01-Aug-2026` and the ISO form `2026-08-01`. */
function parseCliDate(value, flag) {
  if (!value) fail(`${flag} needs a date, e.g. ${flag}=01-Aug-2026`);
  const imap = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  if (imap) {
    const month = MONTHS[imap[2].toLowerCase()];
    if (month === undefined) fail(`${flag}: unknown month "${imap[2]}"`);
    return new Date(Date.UTC(Number(imap[3]), month, Number(imap[1])));
  }
  const iso = new Date(value);
  if (Number.isNaN(iso.getTime())) fail(`${flag}: could not parse "${value}"`);
  return iso;
}

function printHelp() {
  console.log(`
Historical careers importer — replays emailed job applications into the database.

  --since=01-Aug-2026     only messages on/after this date (IMAP or ISO form)
  --before=01-Sep-2026    only messages before this date
  --dry-run               print the plan and change nothing   [DEFAULT]
  --commit                actually write to the database
  --limit=N               process at most N messages
  --out=<file>            dump the parsed applications as JSON (no resume bytes)
  --mailbox=<name>        default "${DEFAULT_MAILBOX}"
  --api=<baseUrl>         API base for --commit (default \$APP_URL)
`);
}

function fail(message) {
  console.error(`\n  ERROR  ${message}\n`);
  process.exit(1);
}

/* ==========================================================================
 * HTML -> payload. Structural parsing against the generated markup.
 * ========================================================================== */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Inner HTML -> plain text, preserving the <br> line breaks escMultiline made. */
function htmlToText(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Value cells that end in a grey `<span>` note — "file.pdf (240 KB, attached)". */
function beforeSpan(html) {
  const i = String(html).indexOf('<span');
  return i === -1 ? String(html) : String(html).slice(0, i);
}

function insideSpan(html) {
  const m = /<span[^>]*>([\s\S]*?)<\/span>/.exec(String(html));
  return m ? htmlToText(m[1]) : '';
}

function hrefs(html) {
  const out = [];
  const re = /<a href="([^"]*)"/g;
  let m;
  while ((m = re.exec(String(html))) !== null) out.push(decodeEntities(m[1]));
  return out;
}

const firstHref = (html) => hrefs(html)[0] || '';

/** Split the email into its titled sections, keyed by the uppercase heading. */
function extractSections(html) {
  const re = new RegExp(`<div style="${escapeRe(SECTION_TITLE_STYLE)}">([\\s\\S]*?)</div>`, 'g');
  const marks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    marks.push({ title: htmlToText(m[1]), start: m.index + m[0].length });
  }
  const sections = {};
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? html.lastIndexOf('<tr>', marks[i + 1].start) : html.length;
    sections[marks[i].title.toLowerCase()] = html.slice(marks[i].start, end);
  }
  return sections;
}

/** Every label/value row inside one section, as a plain object of raw HTML. */
function extractRows(sectionHtml) {
  const re = new RegExp(
    `<td style="${escapeRe(LABEL_CELL)}">([\\s\\S]*?)</td><td style="${escapeRe(VALUE_CELL)}">([\\s\\S]*?)</td>`,
    'g'
  );
  const rows = {};
  let m;
  while ((m = re.exec(String(sectionHtml ?? ''))) !== null) {
    rows[htmlToText(m[1])] = m[2];
  }
  return rows;
}

function extractAnswers(sectionHtml) {
  if (!sectionHtml) return [];
  const re = new RegExp(
    `<div style="${escapeRe(TEXTBLOCK_HEADING_STYLE)}">([\\s\\S]*?)</div>\\s*<div style="${escapeRe(
      TEXTBLOCK_BODY_STYLE
    )}">([\\s\\S]*?)</div>`,
    'g'
  );
  const out = [];
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    const question = htmlToText(m[1]);
    const answer = htmlToText(m[2]);
    if (question && answer) out.push({ question, answer });
  }
  return out;
}

function extractCoverLetter(sectionHtml) {
  if (!sectionHtml) return null;
  const re = new RegExp(`<td style="${escapeRe(PARAGRAPH_BLOCK_STYLE)}">([\\s\\S]*?)</td>`);
  const m = re.exec(sectionHtml);
  const text = m ? htmlToText(m[1]) : '';
  return text || null;
}

const clean = (v) => {
  const t = htmlToText(v);
  return t || undefined;
};

const intOrUndefined = (v) => {
  const n = Number(String(htmlToText(v)).replace(/[^\d-]/g, ''));
  return Number.isFinite(n) && String(htmlToText(v)).trim() !== '' ? n : undefined;
};

const dropUndefined = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
};

/**
 * Turn one admin-notification email back into the ApplicationPayload it was
 * built from. Returns `{ payload, warnings }` — `payload.jobId` is filled in
 * later by the catalog mapping step.
 */
function parseApplicationEmail(html) {
  const warnings = [];
  const sections = extractSections(html);

  const candidate = extractRows(sections['candidate']);
  const links = extractRows(sections['links']);
  const education = extractRows(sections['education']);
  const availability = extractRows(sections['availability']);
  const role = extractRows(sections['role details']);

  const candidateName = clean(candidate['Name']);
  const bodyEmail = htmlToText(candidate['Email']) || null;

  const resumeCellName = clean(beforeSpan(candidate['Resume'] ?? ''));

  const collegeMandated = clean(availability['College-mandated OJT']);

  const programme = clean(education['Programme']);
  let degree;
  let branch;
  if (programme) {
    const parts = programme.split(' — ');
    degree = parts[0]?.trim() || undefined;
    branch = parts[1]?.trim() || undefined;
  }

  const scoreTypeRaw = insideSpan(education['Score'] ?? '')
    .replace(/[()]/g, '')
    .trim()
    .toLowerCase();

  const workLinks = hrefs(links['Work'] ?? '');

  const remote = clean(role['Remote']);
  const skills = clean(role['Skills']);

  if (!candidateName) warnings.push('no candidate name row in the email body');

  const payload = {
    // job identity — jobId/jobSlug are reconciled against the catalog later
    jobId: intOrUndefined(role['Job ID']),
    jobSlug: clean(role['Slug']),
    jobTitle: clean(role['Position']),
    jobTrack: clean(role['Track']),
    productTeam: clean(role['Product team']),
    companyName: clean(role['Company']) || 'Flocci Technologies',
    jobType: clean(role['Type']),
    location: clean(role['Location']),
    isRemote: remote === undefined ? undefined : remote === 'Yes',
    requiredSkills: skills ? skills.split(',').map((s) => s.trim()).filter(Boolean) : undefined,

    // candidate
    candidateName,
    candidateEmail: undefined, // filled from the Reply-To header — far safer
    phone: clean(candidate['Phone']),

    coverLetter: extractCoverLetter(sections['cover letter']) ?? undefined,

    links: dropUndefined({
      linkedin: firstHref(links['LinkedIn'] ?? '') || undefined,
      github: firstHref(links['GitHub'] ?? '') || undefined,
      portfolio: firstHref(links['Portfolio'] ?? '') || undefined,
      work: workLinks,
    }),

    education: dropUndefined({
      institution: clean(education['Institution']),
      degree,
      branch,
      yearOfStudy: clean(education['Year of study']),
      graduationYear: intOrUndefined(education['Graduating']),
      scoreType: scoreTypeRaw === 'cgpa' || scoreTypeRaw === 'percentage' ? scoreTypeRaw : undefined,
      score: clean(beforeSpan(education['Score'] ?? '')),
      city: clean(education['City']),
    }),

    availability: dropUndefined({
      earliestStart: clean(availability['Earliest start']),
      hoursPerWeek: intOrUndefined(availability['Hours / week']),
      isCollegeMandated:
        collegeMandated === undefined ? undefined : collegeMandated.startsWith('Yes'),
      trainingWindow: clean(availability['Training window']),
      mentorEmail: htmlToText(availability['Mentor / TPO'] ?? '') || undefined,
    }),

    answers: extractAnswers(sections['screening answers']),

    meta: dropUndefined({
      source: clean(role['Source']),
      pageUrl: firstHref(role['Applied from'] ?? '') || undefined,
      submittedAt: clean(role['Submitted at']),
    }),
  };

  if (!payload.answers?.length) delete payload.answers;

  return { payload, warnings, bodyEmail, resumeCellName };
}

/* ==========================================================================
 * Job catalog mapping
 * ========================================================================== */

const normalise = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

async function loadJobCatalog() {
  const catalogPath = path.resolve(
    REPO_ROOT,
    '..',
    'flocci-official-landing-page',
    'src',
    'data',
    'careers.mjs'
  );
  if (!fs.existsSync(catalogPath)) {
    fail(`Job catalog not found at ${catalogPath}`);
  }
  const mod = await import(pathToFileURL(catalogPath).href);
  if (!Array.isArray(mod.jobOpenings)) fail('careers.mjs did not export jobOpenings');
  return mod.jobOpenings;
}

/**
 * Recover the posting behind an email.
 *
 * The generated body carries the Job ID and Slug rows outright, so those come
 * first and are the reliable path. Title matching is the fallback, and titles
 * are NOT unique in the catalog ("Software Engineering Intern" appears three
 * times), so a title-only match must also agree on the product team or be
 * unambiguous — otherwise we refuse and let a human look.
 */
function matchJob(catalog, payload) {
  if (payload.jobId !== undefined) {
    const byId = catalog.find((j) => j.id === payload.jobId);
    if (byId) return { job: byId, how: 'job id in body' };
  }
  if (payload.jobSlug) {
    const bySlug = catalog.find((j) => j.slug === payload.jobSlug);
    if (bySlug) return { job: bySlug, how: 'slug in body' };
  }

  const title = normalise(payload.jobTitle);
  const product = normalise(payload.productTeam);
  if (!title) return { job: null, how: 'no job title in body' };

  const byTitle = catalog.filter((j) => normalise(j.title) === title);
  if (byTitle.length === 1) return { job: byTitle[0], how: 'unique title match' };
  if (byTitle.length > 1 && product) {
    const withProduct = byTitle.filter((j) => normalise(j.product) === product);
    if (withProduct.length === 1) return { job: withProduct[0], how: 'title + product match' };
  }
  return {
    job: null,
    how: byTitle.length
      ? `ambiguous title "${payload.jobTitle}" (${byTitle.length} postings share it)`
      : `no posting matches title "${payload.jobTitle}"`,
  };
}

/* ==========================================================================
 * Mailbox
 * ========================================================================== */

function pickResumeAttachment(attachments) {
  for (const att of attachments || []) {
    if (att.contentDisposition === 'inline' && !att.filename) continue;
    const name = String(att.filename || '');
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (RESUME_EXTENSIONS.includes(ext)) return att;
  }
  return null;
}

async function fetchApplicationEmails(opts) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    fail('SMTP_USER and SMTP_PASS must be set in .env (IMAP reuses the existing app password).');
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const messages = [];
  await client.connect();
  const lock = await client.getMailboxLock(opts.mailbox);
  try {
    const query = { subject: SUBJECT_PREFIX };
    if (opts.since) query.since = opts.since;
    if (opts.before) query.before = opts.before;

    let uids = await client.search(query, { uid: true });
    if (!uids || uids.length === 0) uids = [];
    console.log(`  Found ${uids.length} message(s) matching "${SUBJECT_PREFIX}" in ${opts.mailbox}`);
    if (opts.limit && uids.length > opts.limit) {
      uids = uids.slice(0, opts.limit);
      console.log(`  --limit=${opts.limit} -> processing the first ${uids.length}`);
    }

    for (const uid of uids) {
      const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const parsed = await simpleParser(msg.source);
      messages.push({ uid, parsed });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  return messages;
}

/* ==========================================================================
 * Build the plan
 * ========================================================================== */

function canonicalEmail(raw) {
  const lowered = String(raw || '').trim().toLowerCase();
  const corrected = (EMAIL_CORRECTIONS[lowered] || lowered).toLowerCase();
  // A merge rewrites the IDENTITY too, not just the grouping. If it only
  // grouped, a person who applied under two addresses would get two profiles —
  // signing in with one would show part of their history and silently hide the
  // rest on an account they don't know exists. The address they actually typed
  // is preserved on the row via `submittedFromEmail`, so nothing is lost.
  const identity = (IDENTITY_MERGES[corrected] || corrected).toLowerCase();
  return {
    identity,
    group: identity,
    corrected: corrected !== lowered,
    merged: identity !== corrected,
  };
}

async function buildPlan(messages, catalog) {
  const records = [];
  const problems = [];

  for (const { uid, parsed } of messages) {
    const html = parsed.html || (parsed.textAsHtml ?? '');
    if (!html) {
      problems.push({ uid, subject: parsed.subject, reason: 'message has no HTML body' });
      continue;
    }

    const { payload, warnings, bodyEmail, resumeCellName } = parseApplicationEmail(html);

    // The Reply-To header is the authoritative candidate address — the route
    // set `replyTo: candidateEmail` on every one of these. Far safer than
    // reading it back out of the rendered body.
    const replyTo = parsed.replyTo?.value?.[0]?.address || null;
    const rawEmail = replyTo || bodyEmail;
    if (!rawEmail) {
      problems.push({ uid, subject: parsed.subject, reason: 'no Reply-To header and no email row' });
      continue;
    }
    if (!replyTo) warnings.push('no Reply-To header — fell back to the body Email row');

    const emails = canonicalEmail(rawEmail);
    if (SKIP_EMAILS.includes(emails.identity) || SKIP_EMAILS.includes(String(rawEmail).toLowerCase())) {
      problems.push({ uid, subject: parsed.subject, reason: `skipped by SKIP_EMAILS (${emails.identity})` });
      continue;
    }

    const { job, how } = matchJob(catalog, payload);
    if (!job) {
      problems.push({ uid, subject: parsed.subject, reason: `job not resolved — ${how}` });
      continue;
    }

    // The catalog is the authority for the identity of the posting; everything
    // else stays exactly as the candidate submitted it.
    payload.jobId = job.id;
    payload.jobSlug = job.slug;
    payload.jobTitle = payload.jobTitle || job.title;
    payload.jobTrack = payload.jobTrack || job.track;
    payload.productTeam = payload.productTeam || job.product;
    payload.jobType = payload.jobType || job.type;
    payload.location = payload.location || job.location;
    if (payload.isRemote === undefined) payload.isRemote = Boolean(job.isRemote);

    // requiredSkills is `job.techStack` on the way out (see the landing page's
    // application-payload.ts) and the email renders it comma-joined — but the
    // individual entries contain commas, so splitting the email back is lossy.
    // Rebuild it from the catalog with the same rule the client used instead.
    const catalogSkills = (job.techStack ?? [])
      .map((s) => String(s).replace(/\s+/g, ' ').trim())
      .filter((s) => s && s.length <= 120)
      .slice(0, 50);
    if (catalogSkills.length) payload.requiredSkills = catalogSkills;

    payload.candidateEmail = emails.identity;
    // Keep the address as typed when we filed it under a different one, so the
    // record carries both (the route stores it in meta + an internal note).
    if (emails.identity !== String(rawEmail).toLowerCase()) {
      payload.submittedFromEmail = String(rawEmail).toLowerCase();
    }
    payload.candidateName =
      payload.candidateName || parsed.replyTo?.value?.[0]?.name || emails.identity.split('@')[0];

    // Prefer the client's own submittedAt; fall back to the message date.
    const metaAt = payload.meta?.submittedAt;
    const submittedAt =
      metaAt && !Number.isNaN(Date.parse(metaAt))
        ? new Date(metaAt).toISOString()
        : new Date(parsed.date || Date.now()).toISOString();

    const attachment = pickResumeAttachment(parsed.attachments);
    if (attachment) {
      payload.resumeFileName = attachment.filename || resumeCellName || 'resume.pdf';
      payload.resumeBase64 = attachment.content.toString('base64');
    } else {
      warnings.push('no resume attachment found on the message');
    }

    records.push({
      uid,
      groupKey: emails.group,
      identityEmail: emails.identity,
      rawEmail: String(rawEmail).toLowerCase(),
      corrected: emails.corrected,
      submittedAt,
      job,
      matchedBy: how,
      resumeBytes: attachment ? attachment.content.length : 0,
      warnings,
      payload,
    });
  }

  // Group by human, oldest first: earliest stays open, the rest are withdrawn.
  const groups = new Map();
  for (const r of records) {
    if (!groups.has(r.groupKey)) groups.set(r.groupKey, []);
    groups.get(r.groupKey).push(r);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
    list.forEach((r, i) => {
      r.status = i === 0 ? 'submitted' : 'withdrawn';
      r.withdrawReason = i === 0 ? undefined : SUPERSEDED_REASON;
    });
  }

  return { groups, problems, total: records.length };
}

/* ==========================================================================
 * Output
 * ========================================================================== */

const shortDate = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });

function printPlan(plan, opts) {
  const line = '─'.repeat(78);
  console.log(`\n${line}`);
  console.log(`  IMPORT PLAN  ${opts.commit ? '(COMMIT — this will write)' : '(DRY RUN — nothing is written)'}`);
  console.log(`  ${plan.total} application(s) across ${plan.groups.size} candidate(s)`);
  console.log(line);

  const sorted = [...plan.groups.entries()].sort((a, b) =>
    Date.parse(a[1][0].submittedAt) - Date.parse(b[1][0].submittedAt)
  );

  let n = 0;
  for (const [groupKey, list] of sorted) {
    n++;
    const name = list[0].payload.candidateName;
    console.log(`\n  ${String(n).padStart(2, ' ')}. ${name}`);
    console.log(`      email    ${groupKey}${list[0].corrected ? '   (corrected by EMAIL_CORRECTIONS)' : ''}`);
    const others = [...new Set(list.map((r) => r.identityEmail))].filter((e) => e !== groupKey);
    if (others.length) console.log(`      merged   ${others.join(', ')}`);
    console.log(`      profile  resolve by email, create with no linked login if absent`);

    for (const r of list) {
      const flag = r.status === 'submitted' ? 'SUBMITTED' : 'WITHDRAWN';
      console.log(
        `        · ${shortDate(r.submittedAt)}  ->  ${flag.padEnd(9)}  ${r.job.title} · ${r.job.product}  [#${r.job.id}]`
      );
      console.log(
        `            matched by ${r.matchedBy}  ·  resume ${
          r.resumeBytes ? `${r.payload.resumeFileName} (${Math.round(r.resumeBytes / 1024)} KB)` : 'MISSING'
        }`
      );
      if (r.status !== 'submitted') console.log(`            reason: superseded during data entry`);
      for (const w of r.warnings) console.log(`            warning: ${w}`);
    }
  }

  if (plan.problems.length) {
    console.log(`\n${line}`);
    console.log(`  NOT IMPORTED — ${plan.problems.length} message(s) need a human`);
    console.log(line);
    for (const p of plan.problems) {
      console.log(`   · uid ${p.uid}  ${p.reason}`);
      console.log(`       subject: ${p.subject || '(none)'}`);
    }
  }

  console.log(`\n${line}`);
  if (!opts.commit) {
    console.log('  Nothing was written. Read the plan above, then re-run with --commit.');
  }
  console.log(`${line}\n`);
}

/** JSON dump for inspection — metadata only, never the resume bytes. */
function writeOut(plan, file) {
  const out = [];
  for (const [groupKey, list] of plan.groups.entries()) {
    for (const r of list) {
      const { resumeBase64, ...payloadWithoutResume } = r.payload;
      out.push({
        uid: r.uid,
        groupKey,
        identityEmail: r.identityEmail,
        submittedAt: r.submittedAt,
        status: r.status,
        withdrawReason: r.withdrawReason,
        matchedBy: r.matchedBy,
        resume: r.resumeBytes
          ? { fileName: r.payload.resumeFileName, sizeBytes: r.resumeBytes }
          : null,
        warnings: r.warnings,
        payload: payloadWithoutResume,
      });
    }
  }
  fs.writeFileSync(file, JSON.stringify({ problems: plan.problems, applications: out }, null, 2));
  console.log(`  Parsed plan written to ${file} (resume bytes excluded)`);
}

/* ==========================================================================
 * Commit
 * ========================================================================== */

async function commitPlan(plan, opts) {
  const serviceKey = process.env.OFFICIAL_ADMIN_SERVICE_KEY;
  if (!serviceKey) fail('OFFICIAL_ADMIN_SERVICE_KEY must be set to commit.');

  const url = `${opts.api}/api/admin/careers/import`;
  console.log(`  Committing to ${url}\n`);

  let created = 0;
  let existing = 0;
  let failed = 0;

  for (const list of plan.groups.values()) {
    for (const r of list) {
      const body = {
        ...r.payload,
        submittedAt: r.submittedAt,
        status: r.status,
        ...(r.withdrawReason ? { withdrawReason: r.withdrawReason } : {}),
      };
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-flocci-service-key': serviceKey },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          failed++;
          console.log(`   FAIL  ${r.identityEmail}  ${r.job.title}  -> ${res.status} ${json.error || ''}`);
          continue;
        }
        if (json.imported) {
          created++;
          console.log(`   OK    ${r.identityEmail}  ${r.job.title}  -> ${json.application?.referenceCode} (${r.status})`);
        } else {
          existing++;
          console.log(`   SKIP  ${r.identityEmail}  ${r.job.title}  -> already imported as ${json.application?.referenceCode}`);
        }
      } catch (e) {
        failed++;
        console.log(`   FAIL  ${r.identityEmail}  ${r.job.title}  -> ${e.message}`);
      }
    }
  }

  console.log(`\n  imported ${created}  ·  already present ${existing}  ·  failed ${failed}\n`);
  if (failed) process.exitCode = 1;
}

/* ==========================================================================
 * Main
 * ========================================================================== */

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('\n  Flocci careers — historical email importer');
  console.log(`  mailbox ${opts.mailbox}  ·  account ${process.env.SMTP_USER || '(SMTP_USER unset)'}`);
  console.log(
    `  window  ${opts.since ? opts.since.toISOString().slice(0, 10) : 'any'} → ${
      opts.before ? opts.before.toISOString().slice(0, 10) : 'any'
    }\n`
  );

  const catalog = await loadJobCatalog();
  const messages = await fetchApplicationEmails(opts);
  const plan = await buildPlan(messages, catalog);

  printPlan(plan, opts);
  if (opts.out) writeOut(plan, opts.out);
  if (opts.commit) await commitPlan(plan, opts);
}

main().catch((e) => {
  console.error('\n  Importer failed:', e?.message || e);
  process.exit(1);
});
