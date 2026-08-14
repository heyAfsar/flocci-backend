#!/usr/bin/env node
/**
 * Cohort-2 applicant notification.
 *
 * Tells each candidate their application is under review, points them at the
 * dashboard, states the one-open-application rule, asks them to start preparing
 * for the interview, and carries a short personal note where their submission
 * had a problem worth naming.
 *
 * Data comes from the LIVE admin API, never from hardcoded values — the role,
 * reference code and closed-application count in the email are the same facts
 * the candidate will see on their dashboard a second later.
 *
 * Dry-run by default. Sending requires --commit.
 *
 *   node scripts/notify-cohort2-applicants.mjs --dry-run
 *   node scripts/notify-cohort2-applicants.mjs --only=pradnyaghodke116@gmail.com --commit
 *   node scripts/notify-cohort2-applicants.mjs --commit
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import nodemailer from 'nodemailer';

/* ==========================================================================
 * Recipients / policy
 * ========================================================================== */

/** The referrer who shared the posting — every applicant came through his link. */
const CC = ['prabhakarrai.kumar31@gmail.com'];

const DASHBOARD_URL = 'https://flocci.in/dashboard';
const CAREERS_URL = 'https://flocci.in/careers';

/**
 * Per-candidate note. Keyed by the identity address the application is filed
 * under. Each is a real, specific observation about that person's submission —
 * never a generic scold.
 */
const PERSONAL_NOTES = {
  'pradnyaghodke116@gmail.com': {
    heading: 'A note on your submissions',
    body: `You sent five applications in under half an hour — one for each open role. We only ever review the first, so the AI Engineering Intern application is the one in front of the team. The other four are closed on your dashboard.`,
  },
  'anjaliprasad9545@gmail.com': {
    heading: 'A note on your two email addresses',
    body: `You applied using two different addresses. Flocci Intelligence flagged this automatically and reported it to the Hiring Team, and we have consolidated both under this address so your entire history sits in one place. Applying under more than one address does not improve your chances — Flocci Talent Suite, the hiring platform we build, links duplicate identities on its own.`,
  },
  'gayatrinanaware3@gmail.com': {
    heading: 'A note on the address you entered',
    body: `The address on your application was typed as <strong>gayatrinanaware3@gmali.com</strong> — "gmali" rather than "gmail". Flocci Intelligence flagged the error and reported it to the Hiring Team, and we have corrected it to the address you are reading now, which is why this is the first message you have received from us. Please use this corrected address when you sign in, and do check it is the one you meant.`,
  },
};

/* ==========================================================================
 * CLI + env
 * ========================================================================== */

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const [, v] = hit.split('=');
  return v === undefined ? true : v;
};

const COMMIT = Boolean(flag('commit', false));
const ONLY = flag('only', null);
const API = String(flag('api', 'https://apis.flocci.in')).replace(/\/$/, '');

function loadEnv() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) throw new Error('Run this from the flocci-backend repo root (.env not found)');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...rest] = t.split('=');
    env[k.trim()] = rest.join('=').trim();
  }
  return env;
}

/* ==========================================================================
 * HTML
 * ========================================================================== */

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const INK = '#12131a';
const MUTED = '#61646e';
const HAIRLINE = '#e7e7ea';
const ACCENT = '#1f6feb';
const CANVAS = '#f4f4f6';

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid ${HAIRLINE};font:400 13px/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${MUTED};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:11px 0 11px 24px;border-bottom:1px solid ${HAIRLINE};font:500 14px/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};text-align:right;">${value}</td>
    </tr>`;
}

function buildEmail({ name, live, closedCount, note }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';

  const noteBlock = note
    ? `
      <tr><td style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:#fbfaf6;border:1px solid #ece7d9;border-radius:10px;">
          <tr><td style="padding:20px 22px;">
            <div style="font:600 11px/1.4 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#8a7a52;padding-bottom:8px;">${esc(note.heading)}</div>
            <div style="font:400 14px/1.7 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#4a4535;">${note.body}</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="height:28px;line-height:28px;">&nbsp;</td></tr>`
    : '';

  const closedLine =
    closedCount > 0
      ? `<p style="margin:0 0 18px 0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
           We accept <strong>one active application per candidate</strong>, across every role. Your earliest submission is the one under review; the other ${closedCount === 1 ? 'one has' : `${closedCount} have`} been closed. Your dashboard shows exactly which is active and which are closed.
         </p>`
      : `<p style="margin:0 0 18px 0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
           We accept <strong>one active application per candidate</strong>, across every role.
         </p>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your application at Flocci</title></head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your application is under review — track it on your Flocci dashboard.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CANVAS};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;">

      <tr><td style="height:4px;line-height:4px;background:linear-gradient(90deg,#1f6feb 0%,#22a06b 50%,#d98b1f 100%);">&nbsp;</td></tr>

      <tr><td style="padding:34px 40px 0 40px;">
        <div style="font:700 19px/1.2 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:${INK};">Flocci Technologies</div>
        <div style="font:400 12px/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};padding-top:5px;">On-Job Training Programme</div>
      </td></tr>

      <tr><td style="padding:26px 40px 0 40px;">
        <span style="display:inline-block;padding:6px 13px;border-radius:999px;background:#eaf2fe;border:1px solid #cfe0fb;font:600 11px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#14539a;">Under review</span>
      </td></tr>

      <tr><td style="padding:18px 40px 0 40px;">
        <h1 style="margin:0;font:600 25px/1.32 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:${INK};">Your application is with our hiring team</h1>
      </td></tr>

      <tr><td style="padding:18px 40px 0 40px;">
        <p style="margin:0 0 18px 0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">Hello ${esc(firstName)},</p>
        <p style="margin:0 0 18px 0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
          Thank you for applying to the Flocci On-Job Training Programme. Your application has moved into review and is being read by the team now. Everything below is live on your dashboard, which is the single place we will post updates from here on.
        </p>
      </td></tr>

      <tr><td style="padding:8px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid ${HAIRLINE};">
          ${detailRow('Role', esc(live.jobTitle))}
          ${detailRow('Team', esc(live.productTeam || live.companyName))}
          ${detailRow('Reference', `<span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;letter-spacing:.03em;">${esc(live.referenceCode)}</span>`)}
          ${detailRow('Submitted', esc(fmtDate(live.submittedAt)))}
          ${detailRow('Status', '<span style="color:#14539a;font-weight:600;">Under review</span>')}
        </table>
      </td></tr>

      <tr><td style="padding:30px 40px 0 40px;" align="center">
        <a href="${DASHBOARD_URL}" style="display:inline-block;padding:14px 32px;border-radius:9px;background:${INK};color:#ffffff;font:600 15px/1 'Helvetica Neue',Helvetica,Arial,sans-serif;text-decoration:none;">Track your application</a>
        <div style="font:400 12px/1.6 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${MUTED};padding-top:12px;">
          Sign in with Google using <strong style="color:${INK};">this email address</strong>, or register with it — your application is linked to it.
        </div>
      </td></tr>

      <tr><td style="height:32px;line-height:32px;">&nbsp;</td></tr>

      <tr><td style="padding:0 40px;">
        <div style="font:600 11px/1.4 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};padding-bottom:10px;border-bottom:1px solid ${HAIRLINE};">One application at a time</div>
      </td></tr>
      <tr><td style="padding:16px 40px 0 40px;">${closedLine}</td></tr>

      <tr><td style="height:12px;line-height:12px;">&nbsp;</td></tr>

      <tr><td style="padding:0 40px;">
        <div style="font:600 11px/1.4 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};padding-bottom:10px;border-bottom:1px solid ${HAIRLINE};">Please start preparing</div>
      </td></tr>
      <tr><td style="padding:16px 40px 0 40px;">
        <p style="margin:0 0 18px 0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
          Shortlisted candidates go straight into a technical conversation, so please begin preparing now. Expect to talk through the work behind the links you shared, your reasoning rather than only your result, and the answers you gave on the application. Calendar blocks and joining details will be shared promptly once your slot is confirmed — watch both your inbox and your dashboard.
        </p>
      </td></tr>

      ${noteBlock}

      <tr><td style="padding:0 40px 34px 40px;">
        <p style="margin:0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
          If anything here looks wrong, reply to this email and it reaches the hiring team directly.
        </p>
        <p style="margin:18px 0 0 0;font:400 15px/1.75 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};">
          Warm regards,<br><strong>Hiring Team</strong><br><span style="color:${MUTED};font-size:14px;">Flocci Technologies</span>
        </p>
      </td></tr>

      <tr><td style="padding:22px 40px;background:#fafafb;border-top:1px solid ${HAIRLINE};">
        <div style="font:400 12px/1.7 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${MUTED};">
          Flocci Technologies · Ranchi, Jharkhand, India<br>
          <a href="${CAREERS_URL}" style="color:${ACCENT};text-decoration:none;">Open roles</a> &nbsp;·&nbsp;
          <a href="${DASHBOARD_URL}" style="color:${ACCENT};text-decoration:none;">Your dashboard</a><br>
          <span style="color:#9598a1;">You are receiving this because you applied to the Flocci On-Job Training Programme.</span>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ==========================================================================
 * Main
 * ========================================================================== */

const OPEN = ['submitted', 'under_review', 'shortlisted', 'interview', 'offer', 'hired'];

async function main() {
  const env = loadEnv();
  const key = env.OFFICIAL_ADMIN_SERVICE_KEY;
  if (!key) throw new Error('OFFICIAL_ADMIN_SERVICE_KEY is not set in .env');

  const res = await fetch(`${API}/api/admin/careers/applications?limit=200`, {
    headers: { 'X-Flocci-Service-Key': key },
  });
  if (!res.ok) throw new Error(`admin API ${res.status}`);
  const { applications } = await res.json();

  // Group by candidate; the open one is the subject of the email.
  const byEmail = new Map();
  for (const a of applications) {
    const k = a.candidateEmail.toLowerCase();
    if (!byEmail.has(k)) byEmail.set(k, []);
    byEmail.get(k).push(a);
  }

  const targets = [];
  for (const [email, apps] of byEmail) {
    if (ONLY && ONLY.toLowerCase() !== email) continue;
    const live = apps.find((a) => OPEN.includes(a.status));
    if (!live) {
      console.log(`  SKIP  ${email} — no open application`);
      continue;
    }
    targets.push({
      email,
      name: live.candidateName,
      live,
      closedCount: apps.length - 1,
      note: PERSONAL_NOTES[email] || null,
    });
  }

  console.log(`\n  Cohort-2 applicant notification  ${COMMIT ? '(SENDING)' : '(DRY RUN)'}`);
  console.log(`  from ${env.SMTP_USER}   cc ${CC.join(', ')}   bcc ${env.SMTP_BCC}\n`);

  for (const t of targets) {
    console.log(`   ${t.email}`);
    console.log(`      ${t.name} · ${t.live.jobTitle} · ${t.live.referenceCode} · ${t.closedCount} closed`);
    console.log(`      note: ${t.note ? t.note.heading : '(none)'}`);
  }

  if (!COMMIT) {
    const outDir = path.join(process.cwd(), 'var');
    fs.mkdirSync(outDir, { recursive: true });
    for (const t of targets) {
      const f = path.join(outDir, `preview-${t.email.replace(/[^a-z0-9]/gi, '_')}.html`);
      fs.writeFileSync(f, buildEmail(t));
      console.log(`\n   preview -> ${f}`);
    }
    console.log('\n  Nothing sent. Open a preview, then re-run with --commit.\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS.replace(/^"|"$/g, '') },
  });

  console.log('');
  for (const t of targets) {
    try {
      await transporter.sendMail({
        from: `"Flocci Technologies" <${env.SMTP_USER}>`,
        to: t.email,
        cc: CC.join(', '),
        bcc: env.SMTP_BCC,
        replyTo: env.ADMIN_EMAIL ? env.ADMIN_EMAIL.split(',')[0].trim() : env.SMTP_USER,
        subject: `Your application is under review — ${t.live.jobTitle} at Flocci`,
        html: buildEmail(t),
      });
      console.log(`   SENT  ${t.email}`);
    } catch (e) {
      console.log(`   FAIL  ${t.email} -> ${e.message}`);
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error('\n  ERROR:', e.message, '\n');
  process.exit(1);
});
