// Reading the guests a host types or pastes into an event's guest list, or a
// group. The website and the phone app share it, through src/lib/events.ts.
// It has no imports, so `npm test` can run guest-input.test.ts on it.

const EMAIL_PATTERN = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export interface ParsedGuest {
  name: string;
  email: string | null;
}

/**
 * Reads a pasted guest list, one guest per line. Understands the ways people
 * copy addresses: "Glinda Upland <glinda@example.com>", "Glinda, glinda@…",
 * a tab between them (from a spreadsheet), or a name or an address alone.
 * Lines it can't make sense of come back in `skipped`.
 */
export function parseGuestList(text: string): { guests: ParsedGuest[]; skipped: string[] } {
  const guests: ParsedGuest[] = [];
  const skipped: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const angle = line.match(/^(.*?)<\s*([^>]+?)\s*>\s*$/);
    let name: string;
    let email: string | null = null;
    if (angle) {
      name = angle[1].replace(/^["'\s]+|["',\s]+$/g, "");
      email = angle[2];
    } else {
      const found = line.match(/[^\s,;<>"]+@[^\s,;<>"]+/);
      if (found) {
        email = found[0];
        name = line.replace(found[0], "").replace(/^[\s,;\t"']+|[\s,;\t"']+$/g, "");
      } else {
        name = line.replace(/[\t,;]+/g, " ").trim();
      }
    }

    if (email && !isEmail(email)) {
      skipped.push(line);
      continue;
    }
    // An address alone: use the part before the @ until the host names them.
    if (!name && email) name = email.split("@")[0];
    if (!name || name.length > 100) {
      skipped.push(line);
      continue;
    }
    guests.push({ name, email: email ? email.toLowerCase() : null });
  }
  return { guests, skipped };
}

/** One row of the add guests form, as typed. */
export interface GuestRow {
  name: string;
  email: string;
}

export type GuestRowsResult =
  | { guests: ParsedGuest[]; error: null }
  | { guests: null; error: string; row: number; field: "name" | "email" };

/**
 * Reads the add guests form, where a host types a name and an optional email
 * on each row. Rows left blank are skipped. Every other row needs a name, and
 * an email has to look like one. On the first problem it says which row
 * (counting from 0) and which field, so the form can point at it.
 */
export function readGuestRows(rows: GuestRow[]): GuestRowsResult {
  const guests: ParsedGuest[] = [];
  for (const [row, typed] of rows.entries()) {
    const name = typed.name.trim();
    const email = typed.email.trim();
    if (!name && !email) continue;
    if (!name) {
      const error = rows.length > 1 ? "Add a name for each guest." : "Add the guest's name.";
      return { guests: null, error, row, field: "name" };
    }
    if (email && !isEmail(email)) {
      return { guests: null, error: "That email address doesn't look right.", row, field: "email" };
    }
    guests.push({ name, email: email ? email.toLowerCase() : null });
  }
  if (guests.length === 0) return { guests: null, error: "Add the guest's name.", row: 0, field: "name" };
  return { guests, error: null };
}

/** How many rows of the add guests form have something typed in them. */
export function filledGuestRows(rows: GuestRow[]): number {
  return rows.filter((row) => row.name.trim() || row.email.trim()).length;
}
