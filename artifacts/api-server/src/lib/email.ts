import nodemailer from "nodemailer";
import { logger } from "./logger";

function getTransporter() {
  const host = process.env["SMTP_HOST"];
  const port = parseInt(process.env["SMTP_PORT"] ?? "587", 10);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const from = process.env["SMTP_FROM"] ?? user ?? "noreply@jsdms.in";

  if (!host || !user || !pass) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return { transporter, from };
}

export function isEmailConfigured(): boolean {
  return !!(
    process.env["SMTP_HOST"] &&
    process.env["SMTP_USER"] &&
    process.env["SMTP_PASS"]
  );
}

export async function sendEmailWithAttachment(opts: {
  to: string[];
  subject: string;
  html: string;
  attachmentBuffer: Buffer;
  attachmentFilename: string;
}): Promise<void> {
  return sendEmailWithAttachments({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: [{ buffer: opts.attachmentBuffer, filename: opts.attachmentFilename }],
  });
}

export async function sendEmailWithAttachments(opts: {
  to: string[];
  subject: string;
  html: string;
  attachments: Array<{ buffer: Buffer; filename: string }>;
}): Promise<void> {
  const conn = getTransporter();
  if (!conn) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.",
    );
  }

  const { transporter, from } = conn;

  await transporter.sendMail({
    from,
    to: opts.to.join(", "),
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments.map((a) => ({
      filename: a.filename,
      content: a.buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })),
  });

  logger.info(
    { to: opts.to, subject: opts.subject, attachmentCount: opts.attachments.length },
    "Email sent successfully",
  );
}
