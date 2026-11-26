// Events, groups and "Start something new": what the website's pages load
// (src/lib/events-page.ts on the website), and its server actions
// (src/lib/actions/events.ts, event-messages.ts, signups.ts, groups.ts).
// Everything about events runs on the website's server: the tables are only
// reachable there, and invitations, reminders and name draws send emails.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  EventFormData,
  EventPageData,
  EventsTabData,
  GroupPageData,
  PlanPickerData,
} from "@shared/events-page-types";
import type { InvitationPageData } from "@shared/invitation-page-types";

import { isGuestAction } from "@shared/app-guest-calls";

import { ApiError, loadPage, runAction } from "@/lib/api";
import { useSession } from "@/lib/auth";

export const eventKeys = {
  tab: (userId: string) => ["events", "tab", userId] as const,
  event: (eventId: string) => ["events", "event", eventId] as const,
  form: (eventId: string) => ["events", "form", eventId] as const,
  planPicker: (userId: string) => ["events", "plan-picker", userId] as const,
  group: (groupId: string) => ["events", "group", groupId] as const,
  invitation: (slug: string, token: string | null, accountId: string) =>
    ["events", "invitation", slug, token ?? "", accountId] as const,
};

/** The demo has no events in the app. Making an account brings them. */
export function eventsInDemo(): never {
  throw new ApiError("Make an account to plan events.");
}

function usePage<T>(key: readonly unknown[], loader: string, ...args: unknown[]) {
  const { userId, demo } = useSession();
  return useQuery({
    queryKey: key,
    // The invitation is a guest page, which works signed out and in the demo
    // too (src/lib/api.ts). The rest need an account.
    enabled: loader === "invitationPage" || (Boolean(userId) && !demo),
    queryFn: async () => {
      const data = await loadPage<T>(loader, ...args);
      if (!data) throw new ApiError("This is gone, or you can't open it anymore.");
      return data;
    },
  });
}

export function useEventsTab() {
  const { userId } = useSession();
  return usePage<EventsTabData>(eventKeys.tab(userId), "eventsTab");
}

export function useEventPage(eventId: string) {
  return usePage<EventPageData>(eventKeys.event(eventId), "eventPage", eventId);
}

/** The event form's choices; for an event being edited, its details too. */
export function useEventForm(eventId?: string | null) {
  return usePage<EventFormData>(eventKeys.form(eventId ?? "new"), "eventForm", eventId ?? null);
}

export function usePlanPicker() {
  const { userId } = useSession();
  return usePage<PlanPickerData>(eventKeys.planPicker(userId), "planPicker");
}

export function useGroupPage(groupId: string) {
  return usePage<GroupPageData>(eventKeys.group(groupId), "groupPage", groupId);
}

/**
 * An event's invitation, as a guest sees it: what the website's /e/<slug>
 * loads (src/lib/invitation-page.ts on the website). `token` is the guest's
 * own RSVP token from their link, or null for the plain event link. Signed
 * out, it's what the website shows a visitor with no account.
 */
export function useInvitationPage(slug: string, token: string | null) {
  const { session } = useSession();
  const key = eventKeys.invitation(slug, token, session?.user.id ?? "");
  return usePage<InvitationPageData>(key, "invitationPage", slug, token);
}

/**
 * Runs one of the website's event, sign-up or group actions, then reloads
 * everything about events, lists and the home screen, since one change can
 * show in several places (a draw hides gifts on lists, a group shares lists).
 */
export function useEventAction<R = unknown>() {
  const queryClient = useQueryClient();
  const { demo } = useSession();
  return useMutation({
    mutationFn: async ({ action, args }: { action: string; args: unknown[] }) => {
      // An RSVP is a guest's, on someone else's real event, so it goes
      // through in the demo too, as it does signed out.
      if (demo && !isGuestAction(action)) eventsInDemo();
      return runAction<R>(action, ...args);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["registry"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["following"] }),
      ]),
  });
}

/** One action, for the many small buttons on an event's page. Throws the website's error. */
export function useRunEventAction() {
  const mutation = useEventAction();
  return {
    run: <R = unknown>(action: string, ...args: unknown[]) =>
      mutation.mutateAsync({ action, args }).then((outcome) => outcome.result as R),
    isPending: mutation.isPending,
  };
}

/** The id at the end of a page the website would go to, such as /dashboard/events/<id>. */
export function idFromPath(path: string | undefined | null, prefix: string): string | null {
  return path?.startsWith(prefix) ? path.slice(prefix.length).split(/[/?#]/)[0] || null : null;
}
