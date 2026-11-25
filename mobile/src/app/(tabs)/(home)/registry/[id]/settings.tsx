// A list's settings: the website's settings page
// (src/app/(protected)/dashboard/registry/[registryId]/settings/page.tsx),
// section by section, in its words, saving through the same server actions.

import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import {
  deletePhrase,
  registryDeletionLines,
  registryHasData,
  type RegistryDeletionSummary,
} from "@shared/delete-confirmation";
import { parseGiftProfile } from "@shared/gift-profile";
import { readReservationPrivacy } from "@shared/gifts";
import {
  LIST_ACCESS,
  LIST_VISIBILITIES,
  listVisibility,
  profileAudience,
  type ListVisibility,
  type ProfileAudience,
} from "@shared/list-access";
import { copyFor } from "@shared/registry-copy";
import { isLinkForStore, isStoreId, MAX_RETAILER_REGISTRIES, parseRetailerRegistries, STORES, type StoreId } from "@shared/retailers";

import { ConfirmDelete } from "@/components/confirm-delete";
import { DateField } from "@/components/date-field";
import { GiftProfileForm } from "@/components/gift-profile-form";
import { Icon } from "@/components/icon";
import { ProfileAudienceChips } from "@/components/profile-audience-chips";
import {
  Button,
  Card,
  Chip,
  Divider,
  ErrorState,
  Field,
  haptic,
  IconButton,
  LoadingState,
  Pill,
  SwitchRow,
  Text,
} from "@/components/ui";
import { errorMessage, useCreateCategory, useRegistry } from "@/lib/data";
import { initials } from "@/lib/format";
import { pickPhoto, uploadListPhoto } from "@/lib/photos";
import {
  loadRegistryDeletionSummary,
  useDeleteCategory,
  useDeleteList,
  useGenerateInviteLink,
  useGroupChoices,
  useInviteManager,
  useManagers,
  useRemoveManager,
  useRenameCategory,
  useReplaceLink,
  useRevokeInvite,
  useSaveGroups,
  useSaveListDetails,
  useSaveListGiftProfile,
  useSaveListPhoto,
  useSaveLocation,
  useSavePaymentMethods,
  useSaveReservationPrivacy,
  useSaveShippingAddress,
  useSaveStoreRegistries,
} from "@/lib/settings-data";
import { registryShareUrl, SITE_URL } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";
import type { RegistryDetail } from "@/lib/types";

export default function ListSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const detail = registry.data;

  if (!detail) {
    return registry.isError ? (
      <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
    ) : (
      <LoadingState />
    );
  }

  const r = detail.registry;
  const isOwner = detail.role === "owner";
  const settings = (r.settings ?? {}) as Record<string, unknown>;
  const privacy = readReservationPrivacy(r.settings);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
      >
        <GeneralPanel detail={detail} />
        <ReservationPanel detail={detail} />
        {r.registry_type === "personal" && privacy.for_child ? (
          <Panel
            title={`About ${r.honoree_names?.trim() || "your child"}`}
            description="Help people pick gifts. Sizes, likes and the rest show on this list, so anyone with its link sees them."
          >
            <ChildGiftProfile detail={detail} />
          </Panel>
        ) : null}
        {isOwner && listVisibility(r) !== "private" ? <GroupsPanel registryId={r.id} /> : null}
        <CategoriesPanel detail={detail} />
        <LocationPanel registryId={r.id} settings={settings} />
        <PaymentsPanel registryId={r.id} settings={settings} />
        <ShippingPanel registryId={r.id} settings={settings} />
        {r.registry_type === "baby" ? <StoreRegistriesPanel registryId={r.id} settings={settings} /> : null}
        <ManagersPanel detail={detail} />
        {isOwner ? <DangerPanel registryId={r.id} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <View style={{ gap: 4 }}>
        <Text variant="title" style={{ fontSize: 20 }}>
          {title}
        </Text>
        {description ? (
          <Text variant="footnote" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** A save button that says "Saved!" for a moment after it works, as the website's do. */
function SaveButton({ title, onPress, loading, saved }: { title: string; onPress: () => void; loading: boolean; saved: boolean }) {
  return <Button title={saved ? "Saved!" : title} onPress={onPress} loading={loading} size="medium" />;
}

function useSaved() {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);
  return [saved, () => setSaved(true)] as const;
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Text variant="footnote" tone="danger">
      {error}
    </Text>
  );
}

// ---------------------------------------------------------------------------

function GeneralPanel({ detail }: { detail: RegistryDetail }) {
  const theme = useTheme();
  const r = detail.registry;
  const copy = copyFor({ registryType: r.registry_type ?? "baby", eventType: r.event_type });
  const isOwner = detail.role === "owner";
  const save = useSaveListDetails(r.id);
  const savePhoto = useSaveListPhoto(r.id);
  const replaceLink = useReplaceLink(r.id);
  const [saved, markSaved] = useSaved();

  const [title, setTitle] = useState(r.title);
  const [honorees, setHonorees] = useState(r.honoree_names ?? "");
  const [eventDate, setEventDate] = useState<string | null>(r.event_date);
  const [description, setDescription] = useState(r.description ?? "");
  const [visibility, setVisibility] = useState<ListVisibility>(listVisibility(r));
  const [audience, setAudience] = useState<ProfileAudience>(profileAudience(r));
  const [error, setError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirmingLink, setConfirmingLink] = useState(false);
  const shareUrl = registryShareUrl(r.slug);

  async function changePhoto() {
    const asset = await pickPhoto();
    if (!asset) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const url = await uploadListPhoto(r.id, asset);
      await savePhoto.mutateAsync(url);
      haptic("success");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Give your registry a name.");
      return;
    }
    save.mutate(
      { title, honoreeNames: honorees, eventDate, description, visibility, profileAudience: audience },
      { onSuccess: () => markSaved(), onError: (e) => setError(errorMessage(e)) }
    );
  }

  return (
    <Panel title="General" description="Update your registry details">
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        {r.photo_url ? (
          <Image source={{ uri: r.photo_url }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, { backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }]}>
            <Text variant="title" style={{ color: theme.onAccentSoft }}>
              {initials(r.honoree_names || r.title)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ gap: 2 }}>
            <Text variant="subhead" style={{ fontWeight: "600" }}>
              Registry photo
            </Text>
            <Text variant="footnote" tone="tertiary">
              Shown at the top of your registry page. Without one, guests see your initials.
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title={r.photo_url ? "Change photo" : "Upload photo"}
              size="small"
              variant="secondary"
              icon="camera"
              loading={photoBusy}
              onPress={changePhoto}
            />
            {r.photo_url ? (
              <Button
                title="Remove"
                size="small"
                variant="ghost"
                onPress={() => savePhoto.mutate(null, { onError: (e) => setError(errorMessage(e)) })}
              />
            ) : null}
          </View>
        </View>
      </View>

      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field
        label={copy.honoreeLabel}
        value={honorees}
        onChangeText={setHonorees}
        placeholder={copy.honoreePlaceholder}
        hint="The name shown to gift givers and in email notifications."
      />
      <DateField label={copy.eventDateLabel} value={eventDate} onChange={setEventDate} />
      <Field label="Welcome Message" value={description} onChangeText={setDescription} multiline />

      <Divider />
      <Text variant="headline">Sharing</Text>
      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          Who can open this list
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {LIST_VISIBILITIES.map((value) => (
            <Chip key={value} label={LIST_ACCESS[value].label} selected={visibility === value} onPress={() => setVisibility(value)} />
          ))}
        </View>
        <Text variant="footnote" tone="tertiary">
          {LIST_ACCESS[visibility].description}
        </Text>
        {visibility === "private" && listVisibility(r) !== "private" ? (
          <View style={[styles.warning, { backgroundColor: theme.accentSoft }]}>
            <Text variant="footnote" style={{ color: theme.onAccentSoft }}>
              When you save, people you&apos;ve sent the link to won&apos;t be able to open it, and it&apos;ll come off any
              event or group you&apos;ve shared it with.
            </Text>
          </View>
        ) : null}
      </View>
      {isOwner ? (
        <ProfileAudienceChips
          visibility={visibility}
          value={audience}
          onValueChange={setAudience}
          hasShippingAddress={Boolean((r.settings as Record<string, unknown> | null)?.shipping_address)}
        />
      ) : null}

      {/* Hidden as soon as Private is chosen, before saving, as on the website. */}
      {visibility !== "private" ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            Link
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy share link"
            onPress={async () => {
              await Clipboard.setStringAsync(shareUrl);
              haptic("success");
              Alert.alert("Copied!", shareUrl);
            }}
            style={[styles.linkBox, { backgroundColor: theme.surfaceAlt }]}
          >
            <Text variant="footnote" style={{ flex: 1 }} numberOfLines={1}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </Text>
            <Icon name="copy" size={16} color={theme.tint} />
          </Pressable>
          {confirmingLink ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="footnote" tone="secondary">
                The link you have now will stop working for everyone who has it. You&apos;ll get a new one to send to the
                people you still want to see this list. Guests who already gave a gift can still get to it from their emails.
              </Text>
              <Button
                title="Turn off this link and get a new one"
                size="small"
                variant="danger"
                loading={replaceLink.isPending}
                onPress={() =>
                  replaceLink.mutate(undefined, {
                    onSuccess: (result) => {
                      setConfirmingLink(false);
                      Alert.alert(
                        "Done",
                        "The old link no longer works. Send this one to the people you want to have it.",
                        [
                          { text: "OK" },
                          { text: "Share", onPress: () => Share.share({ message: registryShareUrl(result.slug) }) },
                        ]
                      );
                    },
                    onError: (e) => setError(errorMessage(e)),
                  })
                }
              />
              <Button title="Keep this link" size="small" variant="ghost" onPress={() => setConfirmingLink(false)} />
            </View>
          ) : (
            <Button title="Get a new link" size="small" variant="ghost" onPress={() => setConfirmingLink(true)} />
          )}
        </View>
      ) : null}

      <ErrorText error={error} />
      <SaveButton title="Save changes" onPress={submit} loading={save.isPending} saved={saved} />
    </Panel>
  );
}

function ReservationPanel({ detail }: { detail: RegistryDetail }) {
  const r = detail.registry;
  const isOwner = detail.role === "owner";
  const privacy = readReservationPrivacy(r.settings);
  const save = useSaveReservationPrivacy(r.id);
  // A list kept for a child always shows what's been reserved, so hiding is off for it.
  const [hide, setHide] = useState(privacy.hide_reservations === true && !privacy.for_child);
  const [forChild, setForChild] = useState(Boolean(privacy.for_child));
  const [saved, markSaved] = useSaved();
  const [error, setError] = useState<string | null>(null);
  const isPersonal = r.registry_type === "personal";

  if (!isOwner) {
    return (
      <Panel title="What's been reserved" description="The owner chooses whether they see what people reserve and pledge.">
        <Text variant="footnote" tone="secondary">
          {privacy.hide_reservations === true && !privacy.for_child
            ? "The owner hides what's been reserved from themselves, so their gifts stay a surprise. You still see everything and get gift emails."
            : "Everyone who manages this list sees what's been reserved."}
        </Text>
      </Panel>
    );
  }

  return (
    <Panel title="What's been reserved" description="Choose whether you see what people reserve and pledge on this list.">
      <View style={{ marginHorizontal: -spacing.lg }}>
        {/* Off and greyed out while the list is kept for a child, as on the website. */}
        <View style={{ opacity: forChild ? 0.45 : 1 }} pointerEvents={forChild ? "none" : "auto"} accessibilityState={{ disabled: forChild }}>
          <SwitchRow
            label="Hide what's been reserved from me"
            description={`Every item shows as not yet reserved for you, and you don't get gift emails. Guests still see what's taken, so nobody buys the same thing twice. Co-managers still see everything. When the list is part of an event, you see what was given, and by whom, from the day after it. Or turn this off any time to see everything.${
              privacy.hide_reservations_source === "exchange" ? " Regibee turned this on when you added this list to a gift exchange." : ""
            }`}
            value={hide && !forChild}
            onValueChange={setHide}
          />
        </View>
        {isPersonal ? (
          <SwitchRow
            label="I keep this list for my child"
            description="You always see what's been reserved, so you can plan, even when the list is in a gift exchange."
            value={forChild}
            onValueChange={setForChild}
          />
        ) : null}
      </View>
      <ErrorText error={error} />
      <SaveButton
        title="Save"
        loading={save.isPending}
        saved={saved}
        onPress={() =>
          save.mutate({ hide: forChild ? false : hide, forChild }, { onSuccess: () => markSaved(), onError: (e) => setError(errorMessage(e)) })
        }
      />
    </Panel>
  );
}

function ChildGiftProfile({ detail }: { detail: RegistryDetail }) {
  const save = useSaveListGiftProfile(detail.registry.id);
  const settings = (detail.registry.settings ?? {}) as Record<string, unknown>;
  return (
    <GiftProfileForm
      initial={parseGiftProfile(settings.gift_profile)}
      child={{ name: detail.registry.honoree_names }}
      onSave={(profile) => save.mutateAsync(profile)}
    />
  );
}

function GroupsPanel({ registryId }: { registryId: string }) {
  const choices = useGroupChoices(registryId, true);
  const save = useSaveGroups(registryId);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [saved, markSaved] = useSaved();
  const [error, setError] = useState<string | null>(null);
  const selected = chosen ?? new Set(choices.data?.sharedWith ?? []);

  return (
    <Panel
      title="Share with a group"
      description="People in these groups who have a Regibee account see this list on their Following page, even when it's private. Anyone with the link can still open it."
    >
      {choices.isPending ? (
        <LoadingState />
      ) : (choices.data?.groups ?? []).length === 0 ? (
        <Text variant="footnote" tone="secondary">
          You don&apos;t have any groups yet. Make one on the{" "}
          <Text variant="footnote" tone="tint" onPress={() => router.navigate("/events")}>
            Events tab
          </Text>
          , or save an event&apos;s guest list as a group.
        </Text>
      ) : (
        <>
          <View style={{ marginHorizontal: -spacing.lg }}>
            {choices.data!.groups.map((group) => (
              <SwitchRow
                key={group.id}
                label={group.name}
                value={selected.has(group.id)}
                onValueChange={(on) => {
                  const next = new Set(selected);
                  if (on) next.add(group.id);
                  else next.delete(group.id);
                  setChosen(next);
                }}
              />
            ))}
          </View>
          <ErrorText error={error} />
          <SaveButton
            title="Save groups"
            loading={save.isPending}
            saved={saved}
            onPress={() =>
              save.mutate([...selected], { onSuccess: () => markSaved(), onError: (e) => setError(errorMessage(e)) })
            }
          />
        </>
      )}
    </Panel>
  );
}

function CategoriesPanel({ detail }: { detail: RegistryDetail }) {
  const registryId = detail.registry.id;
  const create = useCreateCategory();
  const rename = useRenameCategory(registryId);
  const remove = useDeleteCategory(registryId);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel title="Categories" description="Organize your registry items into categories">
      <View style={{ gap: spacing.sm }}>
        {detail.categories.map((category) =>
          editing?.id === category.id ? (
            <View key={category.id} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Field value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} autoFocus />
              </View>
              <Button
                title="Save"
                size="small"
                disabled={!editing.name.trim()}
                onPress={() => {
                  rename.mutate(
                    { categoryId: category.id, name: editing.name },
                    { onError: (e) => setError(errorMessage(e)) }
                  );
                  setEditing(null);
                }}
              />
              <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => setEditing(null)} />
            </View>
          ) : (
            <View key={category.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 40 }}>
              <Text variant="callout" style={{ flex: 1 }}>
                {category.name}
              </Text>
              <IconButton icon="edit" accessibilityLabel={`Rename ${category.name}`} onPress={() => setEditing({ id: category.id, name: category.name })} />
              <IconButton
                icon="trash"
                accessibilityLabel={`Delete ${category.name}`}
                onPress={() =>
                  Alert.alert(`Delete category “${category.name}”?`, "Items will become uncategorized.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => remove.mutate(category.id, { onError: (e) => setError(errorMessage(e)) }),
                    },
                  ])
                }
              />
            </View>
          )
        )}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Field value={newName} onChangeText={setNewName} placeholder="New category name" returnKeyType="done" />
        </View>
        <IconButton
          icon="add"
          accessibilityLabel="Add category"
          onPress={() => {
            if (!newName.trim()) return;
            create.mutate(
              { registryId, name: newName },
              { onSuccess: () => setNewName(""), onError: (e) => setError(errorMessage(e)) }
            );
          }}
        />
      </View>
      <ErrorText error={error} />
    </Panel>
  );
}

function LocationPanel({ registryId, settings }: { registryId: string; settings: Record<string, unknown> }) {
  const save = useSaveLocation(registryId);
  const [zipCode, setZipCode] = useState((settings.zip_code as string | undefined) ?? "");
  const [taxEnabled, setTaxEnabled] = useState(settings.tax_enabled !== false);
  const [saved, markSaved] = useSaved();
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="Location" description="Used to estimate sales tax on item prices when auto-filling from product URLs">
      <Field label="Zip Code" value={zipCode} onChangeText={setZipCode} placeholder="e.g., 90210" keyboardType="number-pad" />
      <View style={{ marginHorizontal: -spacing.lg }}>
        <SwitchRow label="Auto-add estimated sales tax to prices" value={taxEnabled} onValueChange={setTaxEnabled} />
      </View>
      <ErrorText error={error} />
      <SaveButton
        title="Save location"
        loading={save.isPending}
        saved={saved}
        onPress={() =>
          save.mutate({ zipCode, taxEnabled }, { onSuccess: () => markSaved(), onError: (e) => setError(errorMessage(e)) })
        }
      />
    </Panel>
  );
}

function PaymentsPanel({ registryId, settings }: { registryId: string; settings: Record<string, unknown> }) {
  const save = useSavePaymentMethods(registryId);
  const methods = (settings.payment_methods ?? {}) as { venmo?: string; paypal?: string; zelle?: string };
  const [venmo, setVenmo] = useState(methods.venmo ?? "");
  const [paypal, setPaypal] = useState(methods.paypal ?? "");
  const [zelle, setZelle] = useState(methods.zelle ?? "");
  const [saved, markSaved] = useSaved();
  const [error, setError] = useState<string | null>(null);
  const plain = { autoCapitalize: "none" as const, autoCorrect: false };
  return (
    <Panel title="Payment methods" description="Add your payment info so gift givers can send you money for cash funds and items you've already purchased.">
      <Field label="Venmo" value={venmo} onChangeText={setVenmo} placeholder="@your-venmo" {...plain} />
      <Field label="PayPal" value={paypal} onChangeText={setPaypal} placeholder="you@email.com or PayPal.me link" {...plain} />
      <Field label="Zelle" value={zelle} onChangeText={setZelle} placeholder="you@email.com or phone number" {...plain} />
      <ErrorText error={error} />
      <SaveButton
        title="Save payment methods"
        loading={save.isPending}
        saved={saved}
        onPress={() =>
          save.mutate({ venmo, paypal, zelle }, { onSuccess: () => markSaved(), onError: (e) => setError(errorMessage(e)) })
        }
      />
    </Panel>
  );
}

function ShippingPanel({ registryId, settings }: { registryId: string; settings: Record<string, unknown> }) {
  const save = useSaveShippingAddress(registryId);
  const [address, setAddress] = useState((settings.shipping_address as string | undefined) ?? "");
  const [saved, markSaved] = useSaved();
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="Shipping address" description="Share your shipping address with gift givers so they know where to send gifts.">
      <Field
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder={"Remi & Max Porter\n123 Main Street, Apt 4B\nNew York, NY 10001"}
        multiline
        textContentType="fullStreetAddress"
      />
      <ErrorText error={error} />
      <SaveButton
        title="Save address"
        loading={save.isPending}
        saved={saved}
        onPress={() => save.mutate(address, { onSuccess: () => markSaved(), onError: (e) => setError(errorMessage(e)) })}
      />
    </Panel>
  );
}

function StoreRegistriesPanel({ registryId, settings }: { registryId: string; settings: Record<string, unknown> }) {
  const theme = useTheme();
  const save = useSaveStoreRegistries(registryId);
  const linked = parseRetailerRegistries(settings);
  const [store, setStore] = useState<StoreId | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const available = STORES.filter((s) => !linked.some((l) => l.store === s.id));

  function add() {
    setError(null);
    if (!store || !isStoreId(store)) {
      setError("Choose a store.");
      return;
    }
    const storeName = STORES.find((s) => s.id === store)?.name;
    const typed = link.trim();
    if (!typed) {
      setError(`Paste the link to your ${storeName} registry.`);
      return;
    }
    // A link typed without https:// gets it, as on the website.
    const url = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`;
    if (!isLinkForStore(url, store)) {
      setError(`That doesn't look like a ${STORES.find((s) => s.id === store)?.name} link.`);
      return;
    }
    save.mutate([...linked, { store, url }], {
      onSuccess: () => {
        setStore(null);
        setLink("");
      },
      onError: (e) => setError(errorMessage(e)),
    });
  }

  return (
    <Panel
      title="Your store registries"
      description="Made a registry at Amazon, Target or another store? Link it here. When a guest buys through your registry link, the store counts the gift toward your registry, so you keep its perks."
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Pill label="Completion discount" tone="tint" />
        <Pill label="Longer returns" tone="tint" />
        <Pill label="Welcome box" tone="tint" />
      </View>
      {linked.map((l) => {
        const name = STORES.find((s) => s.id === l.store)?.name ?? l.store;
        return (
          <View key={l.store} style={[styles.linkBox, { backgroundColor: theme.surfaceAlt }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subhead" style={{ fontWeight: "600" }}>
                {name}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {l.url}
              </Text>
            </View>
            <Button
              title="Remove"
              size="small"
              variant="ghost"
              onPress={() =>
                save.mutate(
                  linked.filter((x) => x.store !== l.store),
                  { onError: (e) => setError(errorMessage(e)) }
                )
              }
            />
          </View>
        );
      })}
      {linked.length < MAX_RETAILER_REGISTRIES && available.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            Add a store registry
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {available.map((s) => (
              <Chip key={s.id} label={s.name} selected={store === s.id} onPress={() => setStore(s.id)} />
            ))}
          </ScrollView>
          <Field
            label="Registry link"
            value={link}
            onChangeText={setLink}
            placeholder="Paste the link to your registry"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Button title="Link" size="medium" onPress={add} loading={save.isPending} />
        </View>
      ) : null}
      <ErrorText error={error} />
    </Panel>
  );
}

const MAX_USES: { label: string; value: number | null }[] = [
  { label: "1 use", value: 1 },
  { label: "5 uses", value: 5 },
  { label: "10 uses", value: 10 },
  { label: "Unlimited", value: null },
];

function ManagersPanel({ detail }: { detail: RegistryDetail }) {
  const theme = useTheme();
  const registryId = detail.registry.id;
  const isOwner = detail.role === "owner";
  const data = useManagers(registryId);
  const invite = useInviteManager(registryId);
  const generate = useGenerateInviteLink(registryId);
  const removeManager = useRemoveManager(registryId);
  const revoke = useRevokeInvite(registryId);
  const [email, setEmail] = useState("");
  const [sent, markSent] = useSaved();
  const [maxUses, setMaxUses] = useState<number | null>(1);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel
      title="Managers"
      description="Invite others to help manage this registry. Managers can add/edit items, view gift activity, and manage categories."
    >
      <Text variant="headline">Current managers</Text>
      {data.isPending ? (
        <LoadingState />
      ) : (
        (data.data?.managers ?? []).map((m) => (
          <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={[styles.avatar, { backgroundColor: theme.tintSoft }]}>
              <Text variant="footnote" tone="tint" style={{ fontWeight: "700" }}>
                {initials(m.name || m.email)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subhead" style={{ fontWeight: "600" }} numberOfLines={1}>
                {m.name || m.email}
              </Text>
              {m.email && m.name ? (
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {m.email}
                </Text>
              ) : null}
            </View>
            <Pill label={m.role === "owner" ? "Owner" : "Manager"} tone={m.role === "owner" ? "accent" : "neutral"} />
            {isOwner && m.role !== "owner" ? (
              <IconButton
                icon="personRemove"
                accessibilityLabel={`Remove ${m.name}`}
                color={theme.danger}
                onPress={() =>
                  Alert.alert("Remove this manager?", "They will lose access to the registry.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () => removeManager.mutate(m.id, { onError: (e) => setError(errorMessage(e)) }),
                    },
                  ])
                }
              />
            ) : null}
          </View>
        ))
      )}

      <Divider />
      <Text variant="headline">Invite by email</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="coparent@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
        </View>
        <Button
          title={sent ? "Sent!" : "Send Invite"}
          size="medium"
          disabled={!email.trim()}
          loading={invite.isPending}
          onPress={() =>
            invite.mutate(email, {
              onSuccess: () => {
                setEmail("");
                markSent();
              },
              onError: (e) => setError(errorMessage(e)),
            })
          }
        />
      </View>

      <Divider />
      <Text variant="headline">Generate invite link</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {MAX_USES.map((option) => (
          <Chip key={option.label} label={option.label} selected={maxUses === option.value} onPress={() => setMaxUses(option.value)} />
        ))}
      </View>
      <Button
        title="Generate"
        size="medium"
        variant="secondary"
        icon="link"
        loading={generate.isPending}
        onPress={() =>
          generate.mutate(maxUses, {
            onSuccess: (result) => setLink(`${SITE_URL}/invite/${result.token}`),
            onError: (e) => setError(errorMessage(e)),
          })
        }
      />
      {link ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy invite link"
          onPress={async () => {
            await Clipboard.setStringAsync(link);
            haptic("success");
            Alert.alert("Copied!", "Send the link to the person you want to help manage this registry.", [
              { text: "OK" },
              { text: "Share", onPress: () => Share.share({ message: link }) },
            ]);
          }}
          style={[styles.linkBox, { backgroundColor: theme.surfaceAlt }]}
        >
          <Text variant="caption" style={{ flex: 1 }} selectable>
            {link}
          </Text>
          <Icon name="copy" size={16} color={theme.tint} />
        </Pressable>
      ) : null}

      {(data.data?.invites ?? []).length > 0 ? (
        <>
          <Divider />
          <Text variant="headline">Active invites</Text>
          {data.data!.invites.map((inv) => (
            <View key={inv.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="subhead" numberOfLines={1}>
                  {inv.email ?? "Invite link"}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {inv.max_uses ? `${inv.use_count}/${inv.max_uses} used` : `${inv.use_count} used`} · expires{" "}
                  {new Date(inv.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              </View>
              {isOwner ? (
                <Button
                  title="Revoke"
                  size="small"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert("Revoke this invite?", "The link will stop working.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Revoke",
                        style: "destructive",
                        onPress: () => revoke.mutate(inv.id, { onError: (e) => setError(errorMessage(e)) }),
                      },
                    ])
                  }
                />
              ) : null}
            </View>
          ))}
        </>
      ) : null}
      <ErrorText error={error} />
    </Panel>
  );
}

function DangerPanel({ registryId }: { registryId: string }) {
  const remove = useDeleteList(registryId);
  const [open, setOpen] = useState(false);
  // What deleting does. "unknown" when the server couldn't say: then the
  // dialog asks for the sentence, as it does for a registry with items.
  const [summary, setSummary] = useState<RegistryDeletionSummary | "unknown" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setError(null);
    setSummary(null);
    setOpen(true);
    setSummary(await loadRegistryDeletionSummary(registryId).catch(() => "unknown" as const));
  }

  const lines =
    summary === null
      ? undefined
      : summary === "unknown"
        ? ["Its items and gift funds are deleted, with the gifts guests reserved or gave.", "The registry's link stops working."]
        : registryDeletionLines(summary);

  return (
    <Panel title="Delete registry" description="Permanently delete this registry and all its items">
      <Button title="Delete registry" variant="danger" icon="trash" onPress={ask} />
      <ConfirmDelete
        visible={open}
        onClose={() => setOpen(false)}
        title="Delete this registry?"
        message="This can't be undone. Deleting this registry does this:"
        lines={lines}
        loading={summary === null}
        phrase={summary !== null && (summary === "unknown" || registryHasData(summary)) ? deletePhrase("registry") : null}
        confirmLabel="Delete registry"
        working={remove.isPending}
        error={error}
        onConfirm={() => {
          setError(null);
          remove.mutate(undefined, {
            onSuccess: () => {
              haptic("success");
              setOpen(false);
              router.dismissTo("/");
            },
            onError: (e) => setError(errorMessage(e)),
          });
        }}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  photo: { width: 72, height: 72, borderRadius: 36 },
  warning: { borderRadius: radius.md, padding: spacing.md },
  linkBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
