import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !port || !user || !pass) {
  console.warn(
    "SMTP environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) are not fully configured. Email sending will likely fail."
  );
}

export const transporter = nodemailer.createTransport({
  host: host,
  port: Number(port),
  secure: Number(port) === 465, // true for 465, false for other ports like 587
  auth: {
    user: user,
    pass: pass,
  },
  // Add a timeout to prevent hanging indefinitely
  connectionTimeout: 5000, // 5 seconds
  greetingTimeout: 5000, // 5 seconds
  socketTimeout: 5000, // 5 seconds
});

export const mailOptions = (to: string, subject: string, html: string) => {
  if (!process.env.SMTP_USER) {
     // This indicates a critical configuration error if SMTP_USER is missing for the 'from' field.
    throw new Error("SMTP_USER environment variable is not set. Cannot determine email sender.");
  }
  return {
    from: process.env.SMTP_USER, // Sender address
    to, // List of receivers
    subject, // Subject line
    html, // HTML body content
  };
};

export const adminEmail = process.env.ADMIN_EMAIL || 'default-admin@example.com';
