// Following people, your profile and your account settings: what the
// website's Following tab and Account page load (src/lib/people-page.ts on
// the website), and its server actions (src/lib/actions/follows.ts,
// follow-invites.ts, profile.ts, gift-profile.ts). Follows and most profile
// settings are only reachable from the website's server.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GiftProfile } from "@shared/gift-profile";
import type { AccountPageData, FollowingTabData } from "@shared/people-page-types";

import { act, ApiError, form, loadPage } from "@/lib/api";
import { useSession } from "@/lib/auth";

export const peopleKeys = {
  following: (userId: string) => ["following", userId] as const,
  account: (userId: string) => ["account", userId] as const,
};

function usePeoplePage<T>(key: readonly unknown[], loader: string) {
  const { userId, demo } = useSession();
  return useQuery({
    queryKey: key,
    enabled: Boolean(userId) && !demo,
    queryFn: async () => {
      const data = await loadPage<T>(loader);
      if (!data) throw new ApiError("You're signed out. Sign in again.");
      return data;
    },
  });
}

export function useFollowingTab() {
  const { userId } = useSession();
  return usePeoplePage<FollowingTabData>(peopleKeys.following(userId), "followingTab");
}

export function useAccountPage() {
  const { userId } = useSession();
  return usePeoplePage<AccountPageData>(peopleKeys.account(userId), "accountPage");
}

export interface SearchResult {
  public_id: string;
  full_name: string | null;
  state: "self" | "none" | "pending" | "approved";
}

/** "Find people": by name, or by a whole email address. */
export function searchPeople(query: string) {
  return act<{ results: SearchResult[]; kind?: "name" | "email" }>("follows.searchPeople", query);
}

/**
 * Runs one of the website's follow or profile actions, then reloads the
 * Following tab, the Account page and the home screen's follow requests.
 */
export function usePeopleAction() {
  const queryClient = useQueryClient();
  const { demo } = useSession();
  return useMutation({
    mutationFn: async ({ action, args }: { action: string; args: unknown[] }) => {
      if (demo) throw new ApiError("Make an account to follow people.");
      return act(action, ...args);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["following"] }),
        queryClient.invalidateQueries({ queryKey: ["account"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
      ]),
  });
}

export function useRunPeopleAction() {
  const mutation = usePeopleAction();
  return {
    run: <R = unknown>(action: string, ...args: unknown[]) => mutation.mutateAsync({ action, args }) as Promise<R>,
    isPending: mutation.isPending,
  };
}

/** "Your profile": the name, the public note and the three switches. */
export function profileForm(input: {
  fullName: string;
  discoverable: boolean;
  findableByEmail: boolean;
  emailFollowRequests: boolean;
  publicNote: string;
}) {
  return form({
    fullName: input.fullName,
    publicNote: input.publicNote,
    discoverable: String(input.discoverable),
    findableByEmail: String(input.findableByEmail),
    emailFollowRequests: String(input.emailFollowRequests),
  });
}

export type { GiftProfile };
