import { Resend } from "resend";

// Server-only: hands emails to Resend, or, in end-to-end tests, to Mailpit,
// the fake inbox that the local Supabase stack runs. Tests read Mailpit to
// check who got which email and to follow the links in it.

export interface EmailAttachment {
  filename: string;
  /** The file's contents as text, like an .ics calendar file. */
  content: string;
  contentType: string;
}

export interface Email {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Extra headers, like List-Unsubscribe. */
  headers?: Record<string, string>;
}

/** The email in the shape Resend's API takes. */
function forResend(email: Email) {
  const { attachments, ...rest } = email;
  return {
    ...rest,
    ...(attachments?.length
      ? {
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(a.content, "utf8").toString("base64"),
            contentType: a.contentType,
          })),
        }
      : {}),
  };
}

interface Mailer {
  send(email: Email): Promise<{ error: { message: string } | null }>;
  sendBatch(emails: Email[]): Promise<{ error: { message: string } | null }>;
}

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const resendMailer: Mailer = {
  send: (email) => resend().emails.send(forResend(email)),
  // Resend's batch endpoint takes no attachments, so batches never carry one.
  sendBatch: (emails) => resend().batch.send(emails.map(({ attachments: _, ...email }) => forResend(email))),
};

/** "Name <a@b.com>" or "a@b.com" as Mailpit's { Name, Email }. */
function mailpitAddress(address: string): { Name: string; Email: string } {
  const match = address.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return match ? { Name: match[1], Email: match[2] } : { Name: "", Email: address.trim() };
}

function mailpitMailer(baseUrl: string): Mailer {
  const send: Mailer["send"] = async (email) => {
    const response = await fetch(`${baseUrl}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: mailpitAddress(email.from),
        To: [mailpitAddress(email.to)],
        ...(email.replyTo ? { ReplyTo: [mailpitAddress(email.replyTo)] } : {}),
        Subject: email.subject,
        HTML: email.html,
        ...(email.headers ? { Headers: email.headers } : {}),
        ...(email.attachments?.length
          ? {
              Attachments: email.attachments.map((a) => ({
                Filename: a.filename,
                ContentType: a.contentType,
                Content: Buffer.from(a.content, "utf8").toString("base64"),
              })),
            }
          : {}),
      }),
    });
    if (!response.ok) return { error: { message: `Mailpit ${response.status}: ${await response.text()}` } };
    return { error: null };
  };
  return {
    send,
    sendBatch: async (emails) => {
      for (const email of emails) {
        const { error } = await send(email);
        if (error) return { error };
      }
      return { error: null };
    },
  };
}

export function getMailer(): Mailer {
  if (process.env.EMAIL_TRANSPORT === "mailpit") {
    return mailpitMailer(process.env.MAILPIT_URL || "http://127.0.0.1:54324");
  }
  return resendMailer;
}

/**
 * Sends one email. Resend reports a rejected email in its result rather than
 * by throwing, so this throws instead, for the caller's catch block to log.
 */
export async function sendEmail(email: Email): Promise<void> {
  const { error } = await getMailer().send(email);
  if (error) throw new Error(error.message);
}
