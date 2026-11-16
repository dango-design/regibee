/**
 * The two emails Supabase sends for accounts: confirming a new account's email
 * address, and resetting a password. Supabase sends these itself, through
 * Resend's SMTP server, so they don't go through src/lib/mailer.ts.
 *
 * Supabase puts in the link when it sends each email. `npm run auth-emails`
 * writes these templates to supabase/templates/, with Supabase's placeholder
 * where the link goes. The local Supabase stack reads those files (see
 * supabase/config.toml). Production needs them pasted into its dashboard: see
 * "Account emails" in CLAUDE.md.
 *
 * The keys of AUTH_EMAILS are Supabase's names for the templates.
 *
 * Keep this file free of imports: Node runs it directly to write the files.
 */

/** Supabase replaces this with the email's link when it sends it. */
export const SUPABASE_LINK = "{{ .ConfirmationURL }}";

// The links last as long as otp_expiry in supabase/config.toml, which is
// 3600 seconds both locally and on production.
const LINK_LIFETIME = "1 hour";

const finePrint = "margin:16px 0 0;color:#535862;font-size:13px;";

function layout(heading: string, body: string): string {
  return `<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#181d27;">
  <p style="margin:0;padding:32px 0 24px;text-align:center;font-size:20px;font-weight:600;color:#004659;">Regibee</p>
  <h1 style="margin:0 0 16px;text-align:center;font-size:18px;">${heading}</h1>
${body}
</div>
`;
}

function button(link: string, label: string): string {
  return `  <p style="margin:24px 0;text-align:center;"><a href="${link}" style="background-color:#004659;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">${label}</a></p>`;
}

function copyLink(link: string): string {
  return `  <p style="${finePrint}">This link works for ${LINK_LIFETIME}. If the button doesn't work, copy this link into your browser:<br /><span style="word-break:break-all;">${link}</span></p>`;
}

export interface AuthEmail {
  subject: string;
  html: (link: string) => string;
}

export const AUTH_EMAILS = {
  confirmation: {
    subject: "Confirm your Regibee account",
    html: (link) =>
      layout(
        "Confirm your email address",
        [
          `  <p style="margin:0;">Thanks for signing up for Regibee. Confirm your email address to finish making your account.</p>`,
          button(link, "Confirm email address"),
          copyLink(link),
          `  <p style="${finePrint}">If you didn't sign up for Regibee, you can ignore this email.</p>`,
        ].join("\n"),
      ),
  },
  recovery: {
    subject: "Reset your Regibee password",
    html: (link) =>
      layout(
        "Reset your password",
        [
          `  <p style="margin:0;">We got a request to reset the password for your Regibee account. Choose a new password with the button below.</p>`,
          button(link, "Choose a new password"),
          copyLink(link),
          `  <p style="${finePrint}">If you didn't ask to reset your password, you can ignore this email. Your password won't change.</p>`,
        ].join("\n"),
      ),
  },
} satisfies Record<string, AuthEmail>;

export type AuthEmailName = keyof typeof AUTH_EMAILS;
