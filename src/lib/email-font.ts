// The font, the layout and the small building blocks every email uses.
//
// Mail apps often drop <style> blocks and web fonts, so everything here uses
// inline styles. An email that sets no font is shown in a serif font (Times)
// by mail apps that have no default of their own, so the font goes on a div
// around the whole email, and again on each table cell, since some mail apps
// don't pass it into tables.
//
// Emails stay light in dark mode (see "Dark mode" in CLAUDE.md), so the
// colors here are fixed.
//
// Keep this file free of imports: Node runs it directly for the account
// emails (src/lib/auth-email-templates.ts).

/** Fonts each device already has. No web font, since mail apps rarely load one. */
export const EMAIL_FONT_FAMILY = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

/** Puts an email's HTML in a div that sets the font. emailLayout does this for every template. */
export function withEmailFont(html: string): string {
  return `<div style="font-family:${EMAIL_FONT_FAMILY};">${html}</div>`;
}

/** Brand teal: buttons, links and the wordmark. */
export const EMAIL_BRAND = "#004659";
/** Body text. */
export const EMAIL_TEXT = "#181d27";
/**
 * Fine print and secondary text. 7.5:1 on white, so it passes WCAG AA at
 * 13px. The old #888 was 3.5:1, and #999 was 2.8:1.
 */
export const EMAIL_MUTED = "#535862";
/** The tint behind the card, and inside info boxes. */
export const EMAIL_TINT = "#F0FAFC";

/** A shaded box for facts, like an event's date and place. */
export const EMAIL_BOX_STYLE = `background:${EMAIL_TINT};border-radius:12px;padding:14px 16px;line-height:1.6;margin:16px 0;`;
/** Small secondary text inside the card. */
export const EMAIL_SMALL_STYLE = `color:${EMAIL_MUTED};font-size:13px;`;

// Every value that goes into an email is escaped: guests type names, messages
// and suggestions on a public page, and owners and managers set titles, names,
// addresses and links. Without this, anyone with a list's link could put their
// own links or images into an email sent from Regibee. Links are escaped too,
// because they go inside an href="" attribute.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Escapes text and keeps its line breaks. */
export function multiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

/** The email's one main action. */
export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${escapeHtml(href)}" style="background-color:${EMAIL_BRAND};color:#ffffff;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

/** An inline text link. */
export function emailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${EMAIL_BRAND};">${escapeHtml(label)}</a>`;
}

/** Secondary actions as a row of text links, for under the button. Links with no href are left out. */
export function emailLinks(links: { href?: string | null; label: string }[]): string {
  const html = links
    .filter((l) => l.href)
    .map((l) => emailLink(l.href!, l.label))
    .join(" &nbsp;·&nbsp; ");
  return html ? `<p style="margin:12px 0;">${html}</p>` : "";
}

/** "Or copy this link:" with the link itself, for invites whose button may not work. */
export function emailCopyLink(href: string): string {
  return `<p style="${EMAIL_SMALL_STYLE}margin:16px 0 0;">Or copy this link:<br/><span style="word-break:break-all;">${escapeHtml(href)}</span></p>`;
}

/**
 * An item from a list: its photo when it has one, its name, and a line under
 * it such as "2 of them · $89.99 each · Amazon".
 */
export function emailItemCard(opts: { title: string; imageUrl?: string | null; details?: string | null }): string {
  const cell = `font-family:${EMAIL_FONT_FAMILY};vertical-align:top;`;
  const photo = opts.imageUrl
    ? `<td style="${cell}width:76px;padding-right:14px;"><img src="${escapeHtml(opts.imageUrl)}" alt="" width="76" height="76" style="display:block;width:76px;height:76px;object-fit:contain;border-radius:10px;border:1px solid #E6ECEE;background:#ffffff;" /></td>`
    : "";
  const details = opts.details
    ? `<p style="margin:4px 0 0;font-size:14px;color:${EMAIL_MUTED};">${escapeHtml(opts.details)}</p>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 16px;"><tr>${photo}<td style="${cell}"><p style="margin:0;font-weight:600;font-size:16px;color:${EMAIL_TEXT};">${escapeHtml(opts.title)}</p>${details}</td></tr></table>`;
}

/** Someone's own words, such as a gift message, set off from the rest. */
export function emailQuote(text: string, byName?: string | null): string {
  const by = byName ? `<br/><span style="font-size:13px;color:${EMAIL_MUTED};">${escapeHtml(byName)}</span>` : "";
  return `<p style="margin:16px 0;padding:12px 14px;background:${EMAIL_TINT};border-radius:10px;">${multiline(text)}${by}</p>`;
}

/**
 * The layout every email shares: the Regibee wordmark, a white card with the
 * email's heading and body, and the fine print under the card.
 *
 * - `preheader` is the line mail apps show under the subject in the inbox.
 *   It's hidden in the email itself. Without one, the inbox shows the first
 *   words of the email.
 * - `eyebrow` is a small line above the heading, usually the list or event.
 * - `heading` says what happened, in a few words.
 * - `footer` says why the person got the email, and how to stop it where
 *   they can. It's plain HTML, already escaped.
 *
 * `top` is HTML for above the heading, such as an invitation's picture.
 * It and `body` are HTML the template has already escaped.
 */
export function emailLayout(opts: {
  top?: string | null;
  preheader?: string | null;
  eyebrow?: string | null;
  heading: string;
  body: string;
  footer?: string | null;
}): string {
  const font = `font-family:${EMAIL_FONT_FAMILY};`;
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_TINT};">${escapeHtml(opts.preheader)}${"&#8204;&nbsp;".repeat(40)}</div>`
    : "";
  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 6px;font-size:13px;color:${EMAIL_MUTED};">${escapeHtml(opts.eyebrow)}</p>`
    : "";
  const footer = opts.footer
    ? `<tr><td style="${font}padding:16px 6px 0;font-size:13px;line-height:1.6;color:${EMAIL_MUTED};">${opts.footer}</td></tr>`
    : "";
  return withEmailFont(`<div style="background:${EMAIL_TINT};padding:24px 12px 32px;color:${EMAIL_TEXT};font-size:15px;line-height:1.55;">
${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:separate;">
<tr><td style="${font}padding:0 6px 14px;font-size:20px;font-weight:700;color:${EMAIL_BRAND};">Regibee</td></tr>
<tr><td style="${font}background:#ffffff;border:1px solid #D5E9EE;border-radius:16px;padding:26px 24px;color:${EMAIL_TEXT};font-size:15px;line-height:1.55;">
${opts.top ?? ""}${eyebrow}<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${EMAIL_TEXT};">${escapeHtml(opts.heading)}</h1>
${opts.body}
</td></tr>
${footer}
</table>
</div>`);
}
