// The font every email uses. An email that sets no font is shown in a serif
// font (Times) by mail apps that have no default of their own.
//
// Mail apps often drop <style> blocks and web fonts, so the font goes in an
// inline style on a div around the whole email. The text inside inherits it.
// An email with a table needs the font on each cell too, since some mail apps
// don't pass it into tables.
//
// Keep this file free of imports: Node runs it directly for the account
// emails (src/lib/auth-email-templates.ts).

/** Fonts each device already has. No web font, since mail apps rarely load one. */
export const EMAIL_FONT_FAMILY = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

/** Puts an email's HTML in a div that sets the font. Every email template ends with this. */
export function withEmailFont(html: string): string {
  return `<div style="font-family:${EMAIL_FONT_FAMILY};">${html}</div>`;
}
