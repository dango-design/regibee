// The add and edit item form. Paste or share a link and it fills in the name,
// price and pictures; everything stays editable.

import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  classifyStoreLink,
  copyLinkSteps,
  storesWithRegistryLinks,
  type RetailerRegistry,
  type StoreId,
} from "@shared/retailers";
import { copyForRegistry } from "@shared/registry-copy";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { PasteLinkButton } from "@/components/paste-link-button";
import { ProductReader } from "@/components/product-reader";
import {
  Button,
  Chip,
  Divider,
  Field,
  haptic,
  IconButton,
  Pill,
  Section,
  Stepper,
  SwitchRow,
  Text,
} from "@/components/ui";
import {
  errorMessage,
  estimateTax,
  listNames,
  removeItemWording,
  useAddItem,
  useCreateCategory,
  useDeleteItem,
  useRegistry,
  useUpdateItem,
} from "@/lib/data";
import { formatGiftDate, giftActivityTag } from "@shared/gifts";
import { guessCategory } from "@shared/item-categories";
import { formatPrice, parsePrice } from "@/lib/format";
import { pickPhoto, uploadListPhoto } from "@/lib/photos";
import { itemMatchKey, normalizeLink, parseSharedText, storeLabel, type ReadProduct } from "@/lib/product";
import { radius, spacing, useTheme } from "@/lib/theme";
import { USED_CONDITIONS, type Item, type ItemInput, type RegistrySummary, type UsedCondition } from "@/lib/types";

// Short links hide the product's real address. After reading one, keep the
// address it led to, so the item matches the same product's other links.
const SHORT_LINK_HOSTS = ["a.co", "amzn.to", "amzn.eu", "tgt.gifts", "walmrt.us"];

function isShortLink(raw: string) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return SHORT_LINK_HOSTS.includes(host);
  } catch {
    return false;
  }
}

export type EditorResult =
  | { type: "added"; registryId: string; title: string }
  | { type: "saved"; registryId: string }
  | { type: "deleted"; registryId: string };

interface Props {
  mode: "add" | "edit";
  registryId: string | null;
  /** Offered as a choice when adding. Leave out to keep the registry fixed. */
  registries?: RegistrySummary[];
  onRegistryChange?: (id: string) => void;
  /**
   * Offers Gift ideas after the registries in the "Add to" row, like one more
   * list. Picking it calls this, which opens the gift idea form (src/app/idea.tsx)
   * with the link.
   */
  onChooseGiftIdea?: () => void;
  item?: Item;
  /** A link and maybe a name from a share or a deep link. */
  initialLink?: string | null;
  initialTitle?: string | null;
  /** Already read in Safari by the share extension, so there's nothing to load. */
  initialProduct?: ReadProduct | null;
  onDone: (result: EditorResult) => void;
  /** Shown above the form, e.g. what was shared. */
  header?: ReactNode;
}

type ReadState = "idle" | "reading" | "done" | "failed";

export function ItemEditor({
  mode,
  registryId,
  registries,
  onRegistryChange,
  onChooseGiftIdea,
  item,
  initialLink,
  initialTitle,
  initialProduct,
  onDone,
  header,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const detail = useRegistry(registryId ?? undefined);
  const addItem = useAddItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createCategory = useCreateCategory();

  const startingLink = item?.external_url ?? (initialLink ? normalizeLink(initialLink) : null) ?? "";
  const [link, setLink] = useState(startingLink);
  // A page read in Safari usually has everything. Without a price, read the
  // link here too; that only fills in what's still empty.
  const readHere = mode === "add" && Boolean(startingLink) && (!initialProduct || initialProduct.price == null);
  const [readingUrl, setReadingUrl] = useState<string | null>(readHere ? startingLink : null);
  const [readState, setReadState] = useState<ReadState>(readHere ? "reading" : initialProduct ? "done" : "idle");
  // Whether the item had a name when reading failed, which changes what's left to fill in.
  const [failedWithName, setFailedWithName] = useState(false);
  const [images, setImages] = useState<string[]>(
    initialProduct?.images.length ? initialProduct.images : item?.image_url ? [item.image_url] : []
  );
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? initialProduct?.images[0] ?? null);

  const [title, setTitle] = useState(item?.title ?? initialProduct?.title ?? initialTitle ?? "");
  const [titleTouched, setTitleTouched] = useState(mode === "edit");
  const [priceText, setPriceText] = useState(
    item?.price != null ? String(item.price) : initialProduct?.price != null ? String(initialProduct.price) : ""
  );
  const [priceTouched, setPriceTouched] = useState(mode === "edit");
  const [quantity, setQuantity] = useState(item?.quantity_needed ?? 1);
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [mostWanted, setMostWanted] = useState(item?.is_essential ?? false);
  const [bought, setBought] = useState(item?.is_parent_purchased ?? false);
  const [openToUsed, setOpenToUsed] = useState(item?.is_open_to_used ?? false);
  const [condition, setCondition] = useState<UsedCondition>(item?.minimum_condition ?? "like-new");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(mode === "edit");
  // The price before estimated sales tax was added, as the website's add dialog shows it.
  const [taxInfo, setTaxInfo] = useState<{ original: string; rate: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showImageLink, setShowImageLink] = useState(false);

  const categories = detail.data?.categories ?? [];
  // Store registries are for baby registries only, as on the website.
  const linkedRegistries = detail.data?.linkedRegistries ?? null;
  // A list with a zip code adds estimated sales tax to what the owner bought.
  const zipCode = detail.data?.zipCode ?? null;
  const otherLists = item?.otherLists ?? [];
  // A registry link on any item shows the owner has a registry at that store,
  // even before they link it in settings, as on the website's dashboard.
  const registryLinkStores = useMemo(
    () => storesWithRegistryLinks((detail.data?.items ?? []).map((i) => i.external_url)),
    [detail.data?.items]
  );
  const duplicate = useMemo(() => {
    const key = itemMatchKey(link);
    if (!key) return null;
    return detail.data?.items.find((i) => i.id !== item?.id && itemMatchKey(i.external_url) === key) ?? null;
  }, [link, detail.data?.items, item?.id]);

  function startReading(raw: string) {
    const { url } = parseSharedText(raw);
    const normalized = normalizeLink(url ?? raw);
    if (!normalized) {
      setError("That doesn't look like a link.");
      return;
    }
    setError(null);
    setLink(normalized);
    setConfirmedDuplicate(false);
    setReadingUrl(normalized);
    setReadState("reading");
  }

  function onProduct(product: ReadProduct | null) {
    const source = readingUrl;
    setReadingUrl(null);
    if (!product) {
      // Safari already gave us something, so that still counts.
      setReadState(initialProduct ? "done" : "failed");
      setFailedWithName(Boolean(title.trim()));
      return;
    }
    setReadState("done");
    haptic("success");
    if (product.title && (!titleTouched || !title.trim())) {
      setTitle(product.title);
      // The website's add dialog guesses a category from the name.
      if (mode === "add" && !categoryTouched) {
        const guess = guessCategory(product.title, categories);
        if (guess) setCategoryId(guess);
      }
    }
    if (product.price != null && (!priceTouched || !priceText.trim())) {
      setPriceText(product.price.toFixed(2));
      setTaxInfo(null);
      if (bought) addTax(product.price);
    }
    if (product.images.length > 0) {
      setImages(product.images);
      if (!imageUrl || mode === "add") setImageUrl(product.images[0]);
    }
    if (source && product.url && isShortLink(source)) setLink(product.url);
  }

  /** Adds estimated sales tax to the price, as the website's add dialog does for what the owner bought. */
  async function addTax(price: number) {
    if (!zipCode || mode !== "add") return;
    const result = await estimateTax(zipCode, price).catch(() => null);
    if (!result) return;
    setPriceText(result.priceWithTax);
    setTaxInfo({ original: price.toFixed(2), rate: result.taxRate });
  }

  async function choosePhoto() {
    if (!registryId) return;
    const asset = await pickPhoto();
    if (!asset) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadListPhoto(registryId, asset);
      setImages((prev) => [url, ...prev.filter((u) => u !== url)]);
      setImageUrl(url);
      haptic("success");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function input(): ItemInput {
    return {
      title,
      external_url: link.trim() ? normalizeLink(link) : null,
      image_url: imageUrl,
      price: parsePrice(priceText),
      quantity_needed: quantity,
      category_id: categoryId,
      is_essential: mostWanted,
      is_parent_purchased: bought,
      is_open_to_used: openToUsed,
      minimum_condition: openToUsed ? condition : null,
      notes,
    };
  }

  function save() {
    setError(null);
    if (!registryId) {
      setError("Pick a registry first.");
      return;
    }
    if (!title.trim()) {
      setError("Give the item a name.");
      return;
    }
    if (link.trim() && !normalizeLink(link)) {
      setError("The link doesn't look right. Fix it or clear it.");
      return;
    }
    if (duplicate && mode === "add" && !confirmedDuplicate) {
      setConfirmedDuplicate(true);
      haptic("warning");
      return;
    }
    if (mode === "add") {
      addItem.mutate(
        { registryId, input: input() },
        {
          onSuccess: (added) => {
            haptic("success");
            onDone({ type: "added", registryId, title: added.title });
          },
          onError: (e) => setError(errorMessage(e)),
        }
      );
    } else if (item) {
      updateItem.mutate(
        { item, input: input() },
        // The form has closed by then, so say so in an alert. The list goes back to how it was.
        { onError: (e) => Alert.alert("Couldn't save your changes", errorMessage(e)) }
      );
      // The list updates right away; the save finishes in the background.
      haptic("success");
      onDone({ type: "saved", registryId });
    }
  }

  function confirmDelete() {
    if (!item) return;
    // The website's edit dialog asks the same (src/components/edit-item-dialog.tsx).
    const wording = removeItemWording(item);
    const run = () => {
      deleteItem.mutate(item, { onError: (e) => Alert.alert("Couldn't remove it", errorMessage(e)) });
      haptic("success");
      onDone({ type: "deleted", registryId: item.registry_id });
    };
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`${wording.title} ${wording.message}`)) run();
      return;
    }
    Alert.alert(wording.title, wording.message, [
      { text: "Cancel", style: "cancel" },
      { text: wording.button, style: "destructive", onPress: run },
    ]);
  }

  function addCategory() {
    const name = newCategory?.trim();
    if (!name || !registryId) return;
    createCategory.mutate(
      { registryId, name },
      {
        onSuccess: (category) => {
          setCategoryId(category.id);
          setCategoryTouched(true);
          setNewCategory(null);
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
  }

  const saving = addItem.isPending;
  const store = storeLabel(link);
  const openUrl = normalizeLink(link);
  const saveTitle =
    mode === "edit" ? "Save changes" : duplicate && confirmedDuplicate ? "Add it again" : "Add item";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={64}>
      {readingUrl ? <ProductReader key={readingUrl} url={readingUrl} onResult={onProduct} /> : null}
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
      >
        {header}

        {mode === "edit" && otherLists.length > 0 ? (
          <View style={[styles.notice, { backgroundColor: theme.tintSoft }]}>
            <Icon name="info" size={16} color={theme.tint} />
            <Text variant="footnote" style={{ flex: 1, color: theme.tint }}>
              It&apos;s also on {listNames(otherLists)}, so changes show there too. Its category is only for this list.
            </Text>
          </View>
        ) : null}

        {mode === "add" && registries && (registries.length > 1 || onChooseGiftIdea) ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Add to
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {registries.map((r) => (
                <Chip
                  key={r.id}
                  label={r.title}
                  selected={r.id === registryId}
                  onPress={() => {
                    onRegistryChange?.(r.id);
                    setCategoryId(null);
                    setConfirmedDuplicate(false);
                  }}
                />
              ))}
              {onChooseGiftIdea ? (
                <Chip label="Gift ideas" icon="sparkles" selected={false} onPress={onChooseGiftIdea} />
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {/* The link, and what reading it found */}
        <View style={{ gap: spacing.sm }}>
          <Field
            label="Product link"
            value={link}
            onChangeText={(text) => {
              setLink(text);
              setConfirmedDuplicate(false);
              if (readState === "failed") setReadState("idle");
            }}
            onSubmitEditing={() => link.trim() && startReading(link)}
            onEndEditing={() => {
              const normalized = normalizeLink(link);
              if (mode === "add" && normalized && normalized !== readingUrl && readState === "idle") startReading(link);
            }}
            placeholder="Paste a link from any store"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="go"
            trailing={
              link ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  {openUrl ? <OpenLinkButton url={openUrl} /> : null}
                  <IconButton
                    icon="close"
                    size={16}
                    color={theme.textTertiary}
                    accessibilityLabel="Clear link"
                    onPress={() => {
                      setLink("");
                      setReadingUrl(null);
                      setReadState("idle");
                    }}
                  />
                </View>
              ) : null
            }
          />
          {!link ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <PasteLinkButton onPaste={startReading} />
              <Text variant="footnote" tone="tertiary" style={{ flex: 1 }}>
                Or share a product to Regibee from any store's app or website.
              </Text>
            </View>
          ) : null}
          <ReadStatus state={readState} store={store} failedWithName={failedWithName} />
          {linkedRegistries ? (
            <StoreLinkStatus link={link} linkedRegistries={linkedRegistries} registryLinkStores={registryLinkStores} />
          ) : null}
          {duplicate && mode === "add" ? (
            <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
              <Icon name="error" size={16} color={theme.onAccentSoft} />
              <Text variant="footnote" style={{ flex: 1, color: theme.onAccentSoft }}>
                “{duplicate.title}” with this link is already on this registry.
                {confirmedDuplicate ? " Tap the button again to add it anyway." : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Pictures */}
        <View style={{ gap: spacing.sm }}>
          {images.length > 0 || imageUrl ? (
            <View style={{ alignItems: "center" }}>
              <ItemImage uri={imageUrl} size={180} rounded={radius.lg} />
            </View>
          ) : null}
            {images.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
                {images.map((uri) => (
                  <Pressable
                    key={uri}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Use this image"
                    accessibilityState={{ selected: uri === imageUrl }}
                    onPress={() => {
                      haptic();
                      setImageUrl(uri);
                    }}
                    style={{
                      borderRadius: radius.md + 2,
                      borderWidth: 2,
                      borderColor: uri === imageUrl ? theme.tint : "transparent",
                    }}
                  >
                    <ItemImage uri={uri} size={56} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" }}>
            <Button
              title={imageUrl ? "Change photo" : "Upload photo"}
              icon="camera"
              size="small"
              variant="secondary"
              loading={uploading}
              onPress={choosePhoto}
            />
            {!showImageLink ? (
              <Button title="Image link" icon="link" size="small" variant="ghost" onPress={() => setShowImageLink(true)} />
            ) : null}
            {imageUrl ? (
              <Button
                title="Remove"
                size="small"
                variant="ghost"
                onPress={() => {
                  setImageUrl(null);
                  setShowImageLink(false);
                }}
              />
            ) : null}
          </View>
          {showImageLink ? (
            <Field
              label="Image link (optional)"
              value={imageUrl ?? ""}
              onChangeText={(text) => setImageUrl(text.trim() || null)}
              placeholder="https://"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          ) : null}
        </View>

        {/* Details */}
        <View style={{ gap: spacing.lg }}>
          <Field
            label="Item name"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setTitleTouched(true);
            }}
            placeholder={readState === "reading" ? "Reading the page…" : "What is it?"}
            multiline
            style={{ minHeight: 44 }}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
          />
          <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Price (optional)"
                value={priceText}
                onChangeText={(text) => {
                  setPriceText(text.replace(/[^0-9.,]/g, ""));
                  setPriceTouched(true);
                  setTaxInfo(null);
                }}
                onBlur={() => {
                  const value = parsePrice(priceText);
                  if (value == null) return;
                  setPriceText(value.toFixed(2));
                  if (bought && !taxInfo) addTax(value);
                }}
                hint={taxInfo ? `$${taxInfo.original} + ~${(taxInfo.rate * 100).toFixed(1)}% tax` : undefined}
                placeholder="0.00"
                keyboardType="decimal-pad"
                leading={<Text tone="tertiary">$</Text>}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                Quantity
              </Text>
              {/* As tall as the price field, so the two line up. */}
              <View style={{ height: 50, justifyContent: "center" }}>
                <Stepper value={quantity} onChange={setQuantity} />
              </View>
            </View>
          </View>
        </View>

        {/* Category */}
        {registryId ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Category
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Chip
                label="No category"
                selected={categoryId === null}
                onPress={() => {
                  setCategoryId(null);
                  setCategoryTouched(true);
                }}
              />
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={c.id === categoryId}
                  onPress={() => {
                    setCategoryId(c.id);
                    setCategoryTouched(true);
                  }}
                />
              ))}
              {newCategory === null ? (
                <Chip label="+ New category" selected={false} onPress={() => setNewCategory("")} />
              ) : null}
            </View>
            {newCategory !== null ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Field
                    value={newCategory}
                    onChangeText={setNewCategory}
                    placeholder="New category"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={addCategory}
                  />
                </View>
                <Button title="Add" size="medium" onPress={addCategory} loading={createCategory.isPending} disabled={!newCategory.trim()} />
                <Button title="Cancel" variant="secondary" size="medium" onPress={() => setNewCategory(null)} />
              </View>
            ) : null}
          </View>
        ) : null}

        <Section>
          <SwitchRow
            icon="star"
            label="Most wanted"
            description="Guests see it tagged Most wanted."
            value={mostWanted}
            onValueChange={setMostWanted}
          />
          <Divider inset={52} />
          <SwitchRow
            icon="checkCircle"
            label={copyForRegistry(detail.data?.registry).selfPurchaseButton}
            value={bought}
            onValueChange={setBought}
          />
          <Divider inset={52} />
          <SwitchRow
            icon="refresh"
            label="Open to used"
            description="Guests may give one secondhand."
            value={openToUsed}
            onValueChange={setOpenToUsed}
          />
          {openToUsed ? (
            <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                Minimum condition
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {USED_CONDITIONS.map((c) => (
                  <Chip key={c.id} label={c.label} selected={condition === c.id} onPress={() => setCondition(c.id)} />
                ))}
              </View>
            </View>
          ) : null}
        </Section>

        <Field
          label="Note for guests (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Size, color, or anything else that helps"
          multiline
        />

        {mode === "edit" && item ? <ItemGifts item={item} /> : null}

        {mode === "edit" && item ? (
          <Button title={removeItemWording(item).button} variant="danger" icon="trash" onPress={confirmDelete} />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        {error ? (
          <Text variant="footnote" tone="danger" style={{ textAlign: "center" }} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button title={saveTitle} onPress={save} loading={saving} disabled={!registryId} />
      </View>
    </KeyboardAvoidingView>
  );
}

/** Guests' gifts of the item, as the website's "Gifts for …" window lists them (src/components/gift-detail-modal.tsx). */
function ItemGifts({ item }: { item: Item }) {
  const gifts = item.purchases;
  if (gifts.length === 0) return null;
  return (
    <Section title={`Gifts for “${item.title}”`}>
      {gifts.map((gift, index) => {
        const tag = giftActivityTag(gift, item.is_parent_purchased);
        return (
          <View key={gift.id}>
            {index > 0 ? <Divider inset={spacing.lg} /> : null}
            <View style={{ padding: spacing.lg, gap: 4, opacity: gift.status === "cancelled" ? 0.5 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                <Text variant="subhead" style={{ fontWeight: "600" }}>
                  {gift.buyer_name}
                </Text>
                <Pill label={tag.label} tone={tag.kind === "cancelled" ? "neutral" : tag.kind === "reserved" ? "tint" : "success"} />
                {gift.quantity > 1 ? (
                  <Text variant="footnote" tone="secondary">
                    × {gift.quantity}
                  </Text>
                ) : null}
                {gift.amount != null ? (
                  <Text variant="footnote" style={{ fontWeight: "600" }}>
                    {formatPrice(gift.amount)}
                  </Text>
                ) : null}
              </View>
              {gift.message ? (
                <Text variant="footnote" tone="secondary">
                  {gift.message}
                </Text>
              ) : null}
              <Text variant="caption" tone="tertiary">
                {gift.created_at ? formatGiftDate(gift.created_at) : ""}
                {gift.buyer_email && !gift.hide_giver ? ` · ${gift.buyer_email}` : ""}
              </Text>
            </View>
          </View>
        );
      })}
    </Section>
  );
}

/** Opens the link as typed in the in-app browser, to check it's the right page. */
function OpenLinkButton({ url }: { url: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open link"
      accessibilityHint="Opens the page in a browser"
      hitSlop={6}
      onPress={() => {
        haptic();
        WebBrowser.openBrowserAsync(url);
      }}
      style={({ pressed }) => [styles.openButton, { backgroundColor: theme.tintSoft, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name="external" size={13} color={theme.tint} weight="semibold" />
      <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
        Open
      </Text>
    </Pressable>
  );
}

/**
 * Whether gifts bought through the link count toward the owner's store
 * registry, worded as the website's StoreLinkNotice
 * (src/components/store-link-notice.tsx). It shows only the two clear cases: a
 * registry link, and a plain link at a store where the owner has a registry.
 */
function StoreLinkStatus({
  link,
  linkedRegistries,
  registryLinkStores,
}: {
  link: string;
  linkedRegistries: RetailerRegistry[];
  registryLinkStores: StoreId[];
}) {
  const theme = useTheme();
  // Remember which link the owner dismissed, so a new one shows the warning again.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const result = classifyStoreLink(link);
  if (!result || dismissedFor === link) return null;
  const { store, kind } = result;

  if (kind === "registry") {
    return (
      <View style={[styles.notice, { backgroundColor: theme.successSoft }]} accessibilityLiveRegion="polite">
        <Icon name="checkCircle" size={16} color={theme.success} />
        <Text variant="footnote" tone="success" style={{ flex: 1 }}>
          <Text variant="footnote" tone="success" style={{ fontWeight: "600" }}>
            {store.name} registry link.
          </Text>{" "}
          Gifts bought through this link count toward your {store.name} registry.
        </Text>
      </View>
    );
  }

  // Only warn when the owner has a registry at this store. Otherwise the
  // warning would be noise.
  const linked = linkedRegistries.find((r) => r.store === store.id);
  if (kind !== "plain" || (!linked && !registryLinkStores.includes(store.id))) return null;

  const color = { color: theme.onAccentSoft };
  return (
    <View style={[styles.notice, { backgroundColor: theme.accentSoft }]} accessibilityLiveRegion="polite">
      <Icon name="error" size={16} color={theme.onAccentSoft} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Text variant="footnote" style={color}>
          <Text variant="footnote" style={[color, { fontWeight: "600" }]}>
            This looks like a regular {store.name} link.
          </Text>{" "}
          Gifts bought through it may not count toward your {store.name} registry.
        </Text>
        <View style={{ gap: 2 }}>
          <Text variant="footnote" style={[color, { fontWeight: "600" }]}>
            To use your registry link instead
          </Text>
          {copyLinkSteps(store).map((step, index) => (
            <Text key={step} variant="footnote" style={color}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md, rowGap: spacing.xs }}>
          {linked ? (
            <Button
              title={`Open my ${store.name} registry`}
              icon="external"
              variant="secondary"
              size="small"
              onPress={() => WebBrowser.openBrowserAsync(linked.url)}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setDismissedFor(link)}
            style={({ pressed }) => ({ minHeight: 36, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text variant="footnote" style={[color, { fontWeight: "600", textDecorationLine: "underline" }]}>
              Use this link anyway
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * What reading the link found, worded as the website's add and edit item
 * dialogs (readLinkMessages in src/components/add-item-dialog.tsx).
 */
function ReadStatus({ state, store, failedWithName }: { state: ReadState; store: string | null; failedWithName: boolean }) {
  const theme = useTheme();
  if (state === "reading") {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={theme.tint} />
        <Text variant="footnote" tone="secondary">
          Reading the product{store ? ` from ${store}` : ""}…
        </Text>
      </View>
    );
  }
  if (state === "done") {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Icon name="checkCircle" size={16} color={theme.success} />
        <Text variant="footnote" tone="secondary">
          Filled in from {store ?? "this link"}. Check it over.
        </Text>
      </View>
    );
  }
  if (state === "failed") {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Icon name="error" size={16} color={theme.textTertiary} />
        <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
          We couldn't read the details from {store ?? "this link"}.{" "}
          {failedWithName
            ? "Your link and name are kept, so fill in the rest by hand."
            : "Your link is kept, so add the name and the rest by hand."}
        </Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 20 },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
