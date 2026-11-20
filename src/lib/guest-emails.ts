// Who sees the email of a guest invited from the people their host follows
// (inviteFollowedPeople in src/lib/actions/events.ts). The invitation goes to
// the email on the guest's account, and the guest row keeps it, linked to the
// account by profile_id. A host sees it only when the two of them follow each
// other. To anyone else on the event's page, and on a group saved from the
// guest list, it shows as private.
//
// This file has no imports, so the browser, the server, tests and the phone
// app can all use it.

/** A guest or group member, as the database keeps it. */
export interface PersonWithEmail {
  email: string | null;
  /** The account the email came from, when it was added from a follow. */
  profile_id?: string | null;
}

/** What a host sees in place of an email from an account they can't see. */
export type ShownEmail<T> = Omit<T, "profile_id"> & {
  email: string | null;
  /**
   * The person has an email, from their Regibee account, that this viewer
   * isn't shown. Invitations and reminders still reach it.
   */
  email_hidden?: boolean;
  /** The email came from their Regibee account, so the host can't change it. */
  from_account?: boolean;
};

/**
 * The person as `viewerId` may see them. An email from an account stays
 * hidden unless the viewer is that account, or the two follow each other
 * (`mutualIds`, from mutualFollowIds in src/lib/follows.ts). The account's id
 * never leaves the server.
 */
export function showEmailTo<T extends PersonWithEmail>(
  person: T,
  viewerId: string,
  mutualIds: ReadonlySet<string>,
): ShownEmail<T> {
  const { profile_id: profileId, ...rest } = person;
  if (!profileId) return rest;
  const visible = profileId === viewerId || mutualIds.has(profileId);
  return {
    ...rest,
    email: visible ? person.email : null,
    email_hidden: !visible && Boolean(person.email),
    from_account: true,
  };
}

/** Whether Regibee can email this guest, whether or not the host sees the address. */
export function canEmail(person: { email: string | null; email_hidden?: boolean }): boolean {
  return Boolean(person.email) || Boolean(person.email_hidden);
}

/** What to show where the email would be. */
export function emailLabel(person: { email: string | null; email_hidden?: boolean }): string {
  if (person.email) return person.email;
  return person.email_hidden ? "Email private" : "No email";
}
