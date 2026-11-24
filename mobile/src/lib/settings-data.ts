// A list's settings: its details, sharing, photo, payments, store registries,
// categories, groups and managers. Each change runs the website's own server
// action (src/lib/actions/registry.ts and friends), so the rules and emails
// are the website's. The settings screen reads the list from useRegistry.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RegistryDeletionSummary } from "@shared/delete-confirmation";
import type { GiftProfile } from "@shared/gift-profile";
import type { ListVisibility, ProfileAudience } from "@shared/list-access";
import type { RetailerRegistry } from "@shared/retailers";

import { act, form, runAction } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { keys } from "@/lib/data";
import { demo, DEMO_USER_ID, isDemo } from "@/lib/demo";
import { profileAudienceColumns, profileAudienceFields, visibilityColumns } from "@shared/list-access";

/** Runs a settings change, then reloads the list and the home screen. */
function useSettingsChange<V, R = unknown>(registryId: string, run: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.registry(registryId) }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", registryId] }),
      ]),
  });
}

export interface ListDetailsInput {
  title: string;
  honoreeNames: string;
  eventDate: string | null;
  description: string;
  visibility: ListVisibility;
  /** Who sees it on the owner's profile. Only the owner's choice is saved. */
  profileAudience: ProfileAudience;
}

/** The General section's "Save changes" (updateRegistry). */
export function useSaveListDetails(registryId: string) {
  return useSettingsChange(registryId, async (input: ListDetailsInput) => {
    if (isDemo()) {
      return demo.updateRegistry(registryId, {
        title: input.title.trim(),
        honoree_names: input.honoreeNames.trim() || null,
        event_date: input.eventDate,
        description: input.description.trim() || null,
        ...visibilityColumns(input.visibility),
        ...profileAudienceColumns(input.profileAudience, input.visibility),
      });
    }
    await act(
      "registry.updateRegistry",
      registryId,
      form({
        title: input.title.trim(),
        honoreeNames: input.honoreeNames.trim(),
        eventDate: input.eventDate ?? "",
        description: input.description.trim(),
        visibility: input.visibility,
        ...profileAudienceFields(input.profileAudience, input.visibility),
      })
    );
  });
}

/** The list's photo, saved as soon as it's uploaded or removed. */
export function useSaveListPhoto(registryId: string) {
  return useSettingsChange(registryId, async (url: string | null) => {
    if (isDemo()) return demo.updateRegistry(registryId, { photo_url: url });
    await act("registry.updateRegistryPhoto", registryId, url);
  });
}

/** "Turn off this link and get a new one". */
export function useReplaceLink(registryId: string) {
  return useSettingsChange(registryId, async () => {
    if (isDemo()) throw new Error("The demo's link can't change.");
    return act<{ slug: string }>("registry.replaceRegistryLink", registryId);
  });
}

/** "Hide what's been reserved from me" and "I keep this list for my child". Only the owner can change them. */
export function useSaveReservationPrivacy(registryId: string) {
  return useSettingsChange(registryId, async (input: { hide: boolean; forChild: boolean }) => {
    if (isDemo()) {
      return demo.updateSettings(registryId, {
        hide_reservations: input.hide,
        hide_reservations_source: "owner",
        for_child: input.forChild,
      });
    }
    await act("registry.updateReservationPrivacy", registryId, input);
  });
}

/** A child's gift profile on their list. */
export function useSaveListGiftProfile(registryId: string) {
  return useSettingsChange(registryId, async (profile: GiftProfile) => {
    if (isDemo()) return demo.updateSettings(registryId, { gift_profile: profile });
    await act("giftProfile.saveListGiftProfile", registryId, profile);
  });
}

export function useRenameCategory(registryId: string) {
  return useSettingsChange(registryId, async ({ categoryId, name }: { categoryId: string; name: string }) => {
    if (isDemo()) return demo.renameCategory(registryId, categoryId, name.trim());
    await act("registry.updateCategory", categoryId, registryId, name.trim());
  });
}

export function useDeleteCategory(registryId: string) {
  return useSettingsChange(registryId, async (categoryId: string) => {
    if (isDemo()) return demo.deleteCategory(registryId, categoryId);
    await act("registry.deleteCategory", categoryId, registryId);
  });
}

/** "Save location": the zip code and whether to add estimated sales tax. */
export function useSaveLocation(registryId: string) {
  return useSettingsChange(registryId, async (input: { zipCode: string; taxEnabled: boolean }) => {
    if (isDemo()) return demo.updateSettings(registryId, { zip_code: input.zipCode.trim() || undefined, tax_enabled: input.taxEnabled });
    await act("registry.updateZipCode", registryId, form({ zipCode: input.zipCode.trim(), taxEnabled: String(input.taxEnabled) }));
  });
}

export function useSavePaymentMethods(registryId: string) {
  return useSettingsChange(registryId, async (input: { venmo: string; paypal: string; zelle: string }) => {
    if (isDemo()) return demo.updateSettings(registryId, { payment_methods: input });
    await act("registry.updatePaymentMethods", registryId, form(input));
  });
}

export function useSaveShippingAddress(registryId: string) {
  return useSettingsChange(registryId, async (address: string) => {
    if (isDemo()) return demo.updateSettings(registryId, { shipping_address: address.trim() || undefined });
    await act("registry.updateShippingAddress", registryId, address);
  });
}

/** "Your store registries": the server checks each link belongs to its store. */
export function useSaveStoreRegistries(registryId: string) {
  return useSettingsChange(registryId, async (registries: RetailerRegistry[]) => {
    if (isDemo()) return demo.updateSettings(registryId, { retailer_registries: registries });
    await act("registry.updateRetailerRegistries", registryId, registries);
  });
}

/** Deletes the list. Only its owner can. */
export function useDeleteList(registryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (isDemo()) return demo.deleteRegistry(registryId);
      // The website goes back to the dashboard afterwards.
      await runAction("registry.deleteRegistry", registryId);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.registry(registryId) });
      return queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** What deleting the list would do, counted by the website's server. */
export async function loadRegistryDeletionSummary(registryId: string): Promise<RegistryDeletionSummary> {
  if (isDemo()) return demo.registryDeletionSummary(registryId);
  const { result } = await runAction<{ summary: RegistryDeletionSummary }>("registry.getRegistryDeletionSummary", registryId);
  return result.summary;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface GroupChoice {
  id: string;
  name: string;
  memberCount?: number;
}

/** The owner's groups, and which ones the list is shared with. */
export function useGroupChoices(registryId: string, enabled: boolean) {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["settings", registryId, "groups"],
    enabled: enabled && Boolean(userId) && userId !== DEMO_USER_ID,
    queryFn: () => act<{ groups: GroupChoice[]; sharedWith: string[] }>("groups.getRegistryGroupChoices", registryId),
  });
}

export function useSaveGroups(registryId: string) {
  return useSettingsChange(registryId, async (groupIds: string[]) => {
    await act("groups.setRegistryGroups", registryId, groupIds);
  });
}

// ---------------------------------------------------------------------------
// Managers
// ---------------------------------------------------------------------------

export interface Manager {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Invite {
  id: string;
  email: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string;
  created_at: string;
}

/** Who helps manage the list, and the invites still open. */
export function useManagers(registryId: string) {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["settings", registryId, "managers"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<{ managers: Manager[]; invites: Invite[] }> => {
      if (isDemo()) {
        return {
          managers: [
            { id: "demo-manager", userId: DEMO_USER_ID, role: "owner", name: "Remi & Max", email: "", createdAt: new Date().toISOString() },
          ],
          invites: [],
        };
      }
      const [managers, invites] = await Promise.all([
        act<{ managers: Manager[] }>("registry.listManagers", registryId),
        act<{ invites: Invite[] }>("registry.listInvites", registryId),
      ]);
      return { managers: managers.managers ?? [], invites: invites.invites ?? [] };
    },
  });
}

function demoRefuses(): never {
  throw new Error("The demo can't invite anyone. Make an account to share a list.");
}

/** "Send Invite": emails someone a link to help manage the list. */
export function useInviteManager(registryId: string) {
  return useSettingsChange(registryId, async (email: string) => {
    if (isDemo()) demoRefuses();
    await act("registry.inviteManagerByEmail", registryId, email.trim());
  });
}

/** "Generate invite link", for 1, 5 or 10 people, or anyone with it. */
export function useGenerateInviteLink(registryId: string) {
  return useSettingsChange(registryId, async (maxUses: number | null) => {
    if (isDemo()) demoRefuses();
    return act<{ token: string }>("registry.generateInviteLink", registryId, maxUses);
  });
}

export function useRemoveManager(registryId: string) {
  return useSettingsChange(registryId, async (managerId: string) => {
    await act("registry.removeManager", registryId, managerId);
  });
}

export function useRevokeInvite(registryId: string) {
  return useSettingsChange(registryId, async (inviteId: string) => {
    await act("registry.revokeInvite", inviteId, registryId);
  });
}
