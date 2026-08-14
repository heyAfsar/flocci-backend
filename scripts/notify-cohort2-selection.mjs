#!/usr/bin/env node
/**
 * Cohort-2 selection confirmation.
 *
 * Sent to candidates who have been selected for the On-Job Training Programme:
 * joining date, reporting time, what happens on day one, and the documents to
 * keep ready for the onboarding portal.
 *
 * Same house theme as scripts/notify-cohort2-applicants.mjs. Role, team,
 * reference code and location are read LIVE from the admin API so the letter
 * can never disagree with the candidate's dashboard.
 *
 * Dry-run by default. Sending requires --commit.
 *
 *   node scripts/notify-cohort2-selection.mjs --dry-run
 *   node scripts/notify-cohort2-selection.mjs --commit
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import nodemailer from 'nodemailer';

/* ==========================================================================
 * Joining details
 * ========================================================================== */

const JOIN_DATE_LABEL = 'Monday, 17 August 2026';
const REPORTING_TIME = '9:00 AM IST';

/** Hiring team + the referrer every applicant came through. */
const CC = ['afsar@flocci.in', 'prabhakarrai.kumar31@gmail.com', 'aliya@flocci.in'];

const DASHBOARD_URL = 'https://flocci.in/dashboard';
const CAREERS_URL = 'https://flocci.in/careers';

/** Statuses that mean "selected" — the only people this letter may go to. */
const SELECTED = ['offer', 'hired'];

const DOCUMENTS = [
  ['Aadhaar card', 'Both sides, clearly legible'],
  ['PAN card', 'Or the acknowledgement if it is still being issued'],
  ['Class 10 marksheet', 'Final marksheet or certificate'],
  ['Class 12 marksheet', 'Final marksheet or certificate'],
  ['Semester marksheets', 'Every semester completed so far'],
];

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
 * HTML — house theme
 * ========================================================================== */

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const INK = '#12131a';
const MUTED = '#61646e';
const HAIRLINE = '#e7e7ea';
const ACCENT = '#1f6feb';
const GREEN = '#12694a';
const CANVAS = '#f4f4f6';
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function detailRow(label, value) {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid ${HAIRLINE};font:400 13px/1.5 ${SANS};color:${MUTED};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:11px 0 11px 24px;border-bottom:1px solid ${HAIRLINE};font:500 14px/1.5 ${SANS};color:${INK};text-align:right;">${value}</td>
    </tr>`;
}

const sectionLabel = (text) => `
  <tr><td style="padding:0 40px;">
    <div style="font:600 11px/1.4 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:${MUTED};padding-bottom:10px;border-bottom:1px solid ${HAIRLINE};">${esc(text)}</div>
  </td></tr>`;

const para = (html) => `
  <tr><td style="padding:16px 40px 0 40px;">
    <p style="margin:0 0 18px 0;font:400 15px/1.75 ${SANS};color:${INK};">${html}</p>
  </td></tr>`;

function documentList() {
  return DOCUMENTS.map(
    ([name, hint]) => `
      <tr>
        <td width="18" style="padding:9px 0;vertical-align:top;font:400 15px/1.6 ${SANS};color:${GREEN};">&bull;</td>
        <td style="padding:9px 0;font:400 14px/1.6 ${SANS};color:${INK};">
          <strong style="font-weight:600;">${esc(name)}</strong>
          <span style="color:${MUTED};"> — ${esc(hint)}</span>
        </td>
      </tr>`,
  ).join('');
}

function buildEmail({ name, live }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your selection — Flocci Technologies</title></head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">You have been selected for the Flocci On-Job Training Programme. You join on ${esc(JOIN_DATE_LABEL)}.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CANVAS};">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;">

      <tr><td style="height:4px;line-height:4px;background:linear-gradient(90deg,#1f6feb 0%,#22a06b 50%,#d98b1f 100%);">&nbsp;</td></tr>

      <tr><td style="padding:34px 40px 0 40px;">
        <div style="font:700 19px/1.2 ${SANS};letter-spacing:-.02em;color:${INK};">Flocci Technologies</div>
        <div style="font:400 12px/1.5 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${MUTED};padding-top:5px;">On-Job Training Programme</div>
      </td></tr>

      <tr><td style="padding:26px 40px 0 40px;">
        <span style="display:inline-block;padding:6px 13px;border-radius:999px;background:#e8f5ef;border:1px solid #c3e4d6;font:600 11px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:${GREEN};">Selected</span>
      </td></tr>

      <tr><td style="padding:18px 40px 0 40px;">
        <h1 style="margin:0;font:600 25px/1.32 ${SANS};letter-spacing:-.02em;color:${INK};">Congratulations — you are joining Flocci</h1>
      </td></tr>

      ${para(`Hello ${esc(firstName)},`)}
      ${para(
        `We are delighted to confirm your selection for the Flocci On-Job Training Programme as <strong>${esc(live.jobTitle)}</strong>. Your application stood out, and the team is looking forward to having you with us.`,
      )}

      <tr><td style="padding:8px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid ${HAIRLINE};">
          ${detailRow('Role', esc(live.jobTitle))}
          ${detailRow('Team', esc(live.productTeam || live.companyName))}
          ${live.location ? detailRow('Location', esc(live.location)) : ''}
          ${detailRow('Joining date', `<strong>${esc(JOIN_DATE_LABEL)}</strong>`)}
          ${detailRow('Reporting time', `<strong>${esc(REPORTING_TIME)}</strong>`)}
          ${detailRow('Reference', `<span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;letter-spacing:.03em;">${esc(live.referenceCode)}</span>`)}
        </table>
      </td></tr>

      <tr><td style="height:30px;line-height:30px;">&nbsp;</td></tr>

      ${sectionLabel('What happens on Monday')}
      ${para(
        `You will receive your <strong>appointment letter</strong> on your joining day, followed by onboarding with the team. Once onboarding is complete you will be sent secure links to the document portal, where you will upload the documents listed below. Calendar blocks and joining details will be shared with you shortly &mdash; please keep an eye on both your inbox and your dashboard.`,
      )}

      ${sectionLabel('Documents to keep ready')}
      ${para(
        `Please have clear scans or photographs of the following ready before Monday. You will upload them to the portal after onboarding &mdash; there is nothing to send by email.`,
      )}
      <tr><td style="padding:0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#fafafb;border:1px solid ${HAIRLINE};border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${documentList()}</table>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="height:30px;line-height:30px;">&nbsp;</td></tr>

      <tr><td style="padding:0 40px;" align="center">
        <a href="${DASHBOARD_URL}" style="display:inline-block;padding:14px 32px;border-radius:9px;background:${INK};color:#ffffff;font:600 15px/1 ${SANS};text-decoration:none;">View your dashboard</a>
        <div style="font:400 12px/1.6 ${SANS};color:${MUTED};padding-top:12px;">
          Sign in with Google using <strong style="color:${INK};">this email address</strong> to see your status and updates.
        </div>
      </td></tr>

      <tr><td style="height:30px;line-height:30px;">&nbsp;</td></tr>

      <tr><td style="padding:0 40px 34px 40px;">
        <p style="margin:0;font:400 15px/1.75 ${SANS};color:${INK};">
          If you have any questions before Monday, or anything above needs to change, simply reply to this email and it reaches the hiring team directly.
        </p>
        <p style="margin:18px 0 0 0;font:400 15px/1.75 ${SANS};color:${INK};">
          Welcome aboard,<br><strong>Hiring Team</strong><br><span style="color:${MUTED};font-size:14px;">Flocci Technologies</span>
        </p>
      </td></tr>

      <tr><td style="padding:22px 40px;background:#fafafb;border-top:1px solid ${HAIRLINE};">
        <div style="font:400 12px/1.7 ${SANS};color:${MUTED};">
          Flocci Technologies · Ranchi, Jharkhand, India<br>
          <a href="${CAREERS_URL}" style="color:${ACCENT};text-decoration:none;">Open roles</a> &nbsp;·&nbsp;
          <a href="${DASHBOARD_URL}" style="color:${ACCENT};text-decoration:none;">Your dashboard</a>
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

async function main() {
  const env = loadEnv();
  const key = env.OFFICIAL_ADMIN_SERVICE_KEY;
  if (!key) throw new Error('OFFICIAL_ADMIN_SERVICE_KEY is not set in .env');

  const res = await fetch(`${API}/api/admin/careers/applications?limit=200`, {
    headers: { 'X-Flocci-Service-Key': key },
  });
  if (!res.ok) throw new Error(`admin API ${res.status}`);
  const { applications } = await res.json();

  // Only people actually marked selected get a selection letter. This is the
  // guard that stops a mis-run mailing an offer to someone under review.
  const targets = applications
    .filter((a) => SELECTED.includes(a.status))
    .filter((a) => !ONLY || ONLY.toLowerCase() === a.candidateEmail.toLowerCase())
    .map((a) => ({ email: a.candidateEmail.toLowerCase(), name: a.candidateName, live: a }));

  if (!targets.length) {
    console.log('\n  No applications in a selected status (offer/hired). Nothing to send.\n');
    return;
  }

  console.log(`\n  Cohort-2 selection confirmation  ${COMMIT ? '(SENDING)' : '(DRY RUN)'}`);
  console.log(`  joining ${JOIN_DATE_LABEL} · reporting ${REPORTING_TIME}`);
  console.log(`  from ${env.SMTP_USER}   cc ${CC.join(', ')}   bcc ${env.SMTP_BCC}\n`);
  for (const t of targets) {
    console.log(`   ${t.email}`);
    console.log(`      ${t.name} · ${t.live.jobTitle} · ${t.live.referenceCode} · status=${t.live.status}`);
  }

  if (!COMMIT) {
    const outDir = path.join(process.cwd(), 'var');
    fs.mkdirSync(outDir, { recursive: true });
    for (const t of targets) {
      const f = path.join(outDir, `selection-${t.email.replace(/[^a-z0-9]/gi, '_')}.html`);
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
        subject: `Congratulations — you are joining Flocci as ${t.live.jobTitle}`,
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
