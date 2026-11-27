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
 * Node runs this file directly to write the files. So it may only import
 * files that have no imports of their own, by their full name ("./x.ts").
 */

import { EMAIL_SMALL_STYLE, emailButton, emailLayout } from "./email-font.ts";

/** Supabase replaces this with the email's link when it sends it. */
export const SUPABASE_LINK = "{{ .ConfirmationURL }}";

// The links last as long as otp_expiry in supabase/config.toml, which is
// 3600 seconds both locally and on production.
const LINK_LIFETIME = "1 hour";

function copyLink(link: string): string {
  return `<p style="${EMAIL_SMALL_STYLE}margin:16px 0 0;">This link works for ${LINK_LIFETIME}. If the button doesn't work, copy this link into your browser:<br /><span style="word-break:break-all;">${link}</span></p>`;
}

export interface AuthEmail {
  subject: string;
  html: (link: string) => string;
}

export const AUTH_EMAILS = {
  confirmation: {
    subject: "Confirm your Regibee account",
    html: (link) =>
      emailLayout({
        preheader: "One click to finish making your account.",
        heading: "Confirm your email address",
        body: [
          `<p style="margin:0;">Thanks for signing up for Regibee. Confirm your email address to finish making your account.</p>`,
          emailButton(link, "Confirm email address"),
          copyLink(link),
        ].join("\n"),
        footer: "If you didn't sign up for Regibee, you can ignore this email.",
      }),
  },
  recovery: {
    subject: "Reset your Regibee password",
    html: (link) =>
      emailLayout({
        preheader: "Choose a new password. The link works for 1 hour.",
        heading: "Reset your password",
        body: [
          `<p style="margin:0;">We got a request to reset the password for your Regibee account. Choose a new password with the button below.</p>`,
          emailButton(link, "Choose a new password"),
          copyLink(link),
        ].join("\n"),
        footer: "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
      }),
  },
} satisfies Record<string, AuthEmail>;

export type AuthEmailName = keyof typeof AUTH_EMAILS;
