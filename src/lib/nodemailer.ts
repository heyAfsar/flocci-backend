import nodemailer from 'nodemailer';

/**
 * Email — adopted onto the shared Flocci notification service (via the
 * public gateway) with the previous SMTP transport kept as the fallback:
 *   - notification service handles plain HTML sends (contact forms etc.)
 *   - messages WITH ATTACHMENTS (careers résumés) stay on SMTP — the
 *     notification contract has no attachment support yet
 *   - if the gateway isn't configured or the send fails, fall back to SMTP
 * The exported surface (`transporter.sendMail(mailOptions(...))`) is
 * unchanged, so all six form routes keep working untouched.
 */

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

const smtpTransporter = nodemailer.createTransport({
  host: host,
  port: Number(port),
  secure: Number(port) === 465,
  auth: { user, pass },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

type MailOpts = {
  from?: string;
  to: string;
  bcc?: string;
  subject: string;
  html: string;
  attachments?: unknown[];
};

const gatewayUrl = () => (process.env.FLOCCI_GATEWAY_URL || '').replace(/\/$/, '');
const notificationsEnabled = () => Boolean(gatewayUrl() && process.env.FLOCCI_SERVICE_KEY);

async function sendViaNotificationService(opts: MailOpts): Promise<{ messageId: string }> {
  const res = await fetch(`${gatewayUrl()}/api/notifications/v1/email/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Flocci-Service-Key': process.env.FLOCCI_SERVICE_KEY as string,
    },
    body: JSON.stringify({
      app_id: 'official-website',
      to: opts.to,
      bcc: opts.bcc || undefined,
      subject: opts.subject,
      html: opts.html,
      idempotency_key: `official-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`notification-service ${res.status}: ${body.slice(0, 200)}`);
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string; message_id?: string };
  return { messageId: body.id || body.message_id || 'notification-service' };
}

export const transporter = {
  async sendMail(opts: MailOpts) {
    const hasAttachments = Array.isArray(opts.attachments) && opts.attachments.length > 0;
    if (notificationsEnabled() && !hasAttachments) {
      try {
        return await sendViaNotificationService(opts);
      } catch (e) {
        console.error('notification-service send failed, falling back to SMTP:', e);
      }
    }
    return smtpTransporter.sendMail(opts as Parameters<typeof smtpTransporter.sendMail>[0]);
  },
};

export const mailOptions = (to: string, subject: string, html: string): MailOpts => {
  if (!process.env.SMTP_USER && !notificationsEnabled()) {
    throw new Error('Neither SMTP_USER nor the Flocci gateway is configured. Cannot send email.');
  }
  return {
    from: process.env.SMTP_USER,
    to,
    bcc: process.env.SMTP_BCC,
    subject,
    html,
  };
};

export const adminEmail = process.env.ADMIN_EMAIL || 'default-admin@example.com';
