/**
 * The sections of the edit event page (EventForm, editing), in order. Each id
 * is the section's #fragment, so other pages can link straight to one, like
 * "Add your invitation" on the event's page.
 */
export type EditEventSection =
  | "details"
  | "invitation"
  | "when"
  | "where"
  | "message"
  | "rsvps"
  | "gifts"
  | "exchange";

/**
 * A link to one section of the edit event page. `editPath` is the page itself:
 * /dashboard/events/<id>/edit, or the demo's.
 */
export function editSectionHref(editPath: string, section: EditEventSection) {
  return `${editPath}#${section}`;
}
