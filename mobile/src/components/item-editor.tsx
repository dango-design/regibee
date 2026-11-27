// The add and edit item form. Paste or share a link and it fills in the name,
// price and pictures; everything stays editable.

import { router } from "expo-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { nameFromProductUrl } from "@shared/shared-link";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { KeyboardFooter, KeyboardScrollView, useKeyboardFooter } from "@/components/keyboard";
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
  useAddItemToList,
  useCreateCategory,
  useDeleteItem,
  useMoveItemToList,
  useRegistry,
  useUpdateItem,
} from "@/lib/data";
import { formatGiftDate, giftActivityTag } from "@shared/gifts";
import { suggestCategory } from "@shared/item-categories";
import { checklistEntry, countedEntry } from "@shared/checklist-matching";
import { NavRow } from "@/components/nav-row";
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
  /**
   * From the baby checklist's "Yes, add its link": the entry's category,
   * quantity and description, and the entry the item counts for.
   */
  fromChecklist?: { categoryId: string | null; quantity: number; notes: string; entry: string } | null;
  onDone: (result: EditorResult) => void;
  /** Shown above the form, e.g. what was shared. */
  header?: ReactNode;
}

// "nothing": the page was read, and it had nothing the form doesn't already show.
type ReadState = "idle" | "reading" | "done" | "nothing" | "failed";

/** What reading a link replaced on an item being edited, so the owner can undo each change. */
interface Replaced {
  title: string | null;
  price: string | null;
  imageUrl: string | null;
}

const NOTHING_REPLACED: Replaced = { title: null, price: null, imageUrl: null };

/** Two prices as typed, compared in cents, so "30" and "30.00" are the same. */
function samePrice(a: string, b: string) {
  const [x, y] = [parsePrice(a), parsePrice(b)];
  return x != null && y != null && Math.round(x * 100) === Math.round(y * 100);
}

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
  fromChecklist,
  onDone,
  header,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardFooter = useKeyboardFooter(Math.max(insets.bottom, spacing.md));
  const detail = useRegistry(registryId ?? undefined);
  const addItem = useAddItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const addToList = useAddItemToList();
  const moveToList = useMoveItemToList();
  const createCategory = useCreateCategory();

  const startingLink = item?.external_url ?? (initialLink ? normalizeLink(initialLink) : null) ?? "";
  const [link, setLink] = useState(startingLink);
  // A page read in Safari usually has everything. Without a price, read the
  // link here too; that only fills in what's still empty.
  const readHere = mode === "add" && Boolean(startingLink) && (!initialProduct || initialProduct.price == null);
  const [readingUrl, setReadingUrl] = useState<string | null>(readHere ? startingLink : null);
  // The product's barcode number and the link it was read from. It's sent
  // only while the item keeps that link (src/lib/gtin.ts on the website).
  const [readGtin, setReadGtin] = useState<{ url: string; gtin: string | null } | null>(
    initialProduct?.gtin && startingLink ? { url: startingLink, gtin: initialProduct.gtin } : null
  );
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
  const [quantity, setQuantity] = useState(item?.quantity_needed ?? fromChecklist?.quantity ?? 1);
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? fromChecklist?.categoryId ?? null);
  const [mostWanted, setMostWanted] = useState(item?.is_essential ?? false);
  const [bought, setBought] = useState(item?.is_parent_purchased ?? false);
  const [openToUsed, setOpenToUsed] = useState(item?.is_open_to_used ?? false);
  const [condition, setCondition] = useState<UsedCondition>(item?.minimum_condition ?? "like-new");
  const [notes, setNotes] = useState(item?.notes ?? fromChecklist?.notes ?? "");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(mode === "edit" || Boolean(fromChecklist?.categoryId));
  // A guessed category the list doesn't have yet, such as "Food & Drink". It
  // shows as chosen and is made when the item is saved, as on the website.
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  // The price before estimated sales tax was added, as the website's add dialog shows it.
  const [taxInfo, setTaxInfo] = useState<{ original: string; rate: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showImageLink, setShowImageLink] = useState(false);
  // Editing: what the last read replaced, for the "Was … · Undo" lines.
  const [replaced, setReplaced] = useState<Replaced>(NOTHING_REPLACED);
  // The name came from the words in the link, because the page couldn't be read.
  const [guessedName, setGuessedName] = useState(false);
  // Looking on the store's page for photos only, from "Look for photos on …".
  const [photosOnly, setPhotosOnly] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  // Lists the item was added to since the form opened, and which list picker is open.
  const [addedTo, setAddedTo] = useState<{ id: string; title: string }[]>([]);
  const [placing, setPlacing] = useState<"add" | "move" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const savedLink = item?.external_url ? normalizeLink(item.external_url) : null;
  // The link the name, price and photo came from. When editing, reading
  // another link replaces them, and reading this one again only refreshes the
  // price and fills in what's empty, as the website's edit dialog does.
  const detailsFrom = useRef<string | null>(savedLink);
  // The link last read, so leaving the field doesn't read the same link again.
  const lastReadUrl = useRef<string | null>(savedLink);
  // The last link whose read changed something.
  const filledFrom = useRef<string | null>(null);

  const categories = detail.data?.categories ?? [];
  // Baby lists have the checklist. The list's copy of the item has the entry
  // as it is now, after the checklist screen changed it.
  const checklistShown = detail.data?.registry.registry_type === "baby";
  const listItem = item ? (detail.data?.items.find((i) => i.id === item.id) ?? item) : null;
  const checklistItem = {
    id: listItem?.id ?? "",
    kind: "item" as const,
    title: title || listItem?.title || "",
    checklist_entry: listItem?.checklist_entry,
  };
  // Store registries are for baby registries only, as on the website.
  const linkedRegistries = detail.data?.linkedRegistries ?? null;
  // A list with a zip code adds estimated sales tax to what the owner bought.
  const zipCode = detail.data?.zipCode ?? null;
  // The other lists it's on: the ones the list knows of, then any just added.
  const otherLists = [
    ...(item?.otherLists ?? []),
    ...addedTo.filter((l) => !(item?.otherListIds ?? []).includes(l.id)).map((l) => l.title),
  ];
  // The owner's lists it isn't on yet. Co-managers get none: they can't add or move.
  const listsToOffer =
    mode === "edit" && item
      ? (detail.data?.ownerLists ?? []).filter(
          (l) => l.id !== registryId && !(item.otherListIds ?? []).includes(l.id) && !addedTo.some((a) => a.id === l.id)
        )
      : [];
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
    setPhotosOnly(false);
    setPhotoStatus(null);
    setGuessedName(false);
    lastReadUrl.current = normalized;
    // Undo lines from another product's read no longer apply.
    if (mode === "edit" && normalized !== detailsFrom.current) setReplaced(NOTHING_REPLACED);
    setReadingUrl(normalized);
    setReadState("reading");
  }

  /** Looks on the store's page for photos, and changes nothing else. The owner picks one of them. */
  function findPhotos() {
    const normalized = normalizeLink(link);
    if (!normalized || readingUrl) return;
    setError(null);
    setPhotoStatus(null);
    setPhotosOnly(true);
    setReadingUrl(normalized);
  }

  /** Puts back the saved link, and stops a read under way. */
  function keepCurrentLink() {
    setReadingUrl(null);
    setPhotosOnly(false);
    setLink(item?.external_url ?? "");
    lastReadUrl.current = savedLink;
    setReadState("idle");
    setError(null);
  }

  function onProduct(product: ReadProduct | null) {
    const source = readingUrl;
    setReadingUrl(null);
    const storeName = storeLabel(source) ?? "the store";
    if (photosOnly) {
      setPhotosOnly(false);
      const found = product?.images ?? [];
      if (found.length === 0) {
        setPhotoStatus(
          product
            ? `We found no photos on ${storeName}'s page.`
            : `We couldn't read ${storeName}'s page.`
        );
        return;
      }
      setImages(found);
      if (!imageUrl) setImageUrl(found[0]);
      else if (found.length === 1 && found[0] === imageUrl) setPhotoStatus(`${storeName} has only this photo.`);
      return;
    }
    if (!product) {
      // Safari already gave us something, so that still counts.
      setReadState(initialProduct ? "done" : "failed");
      // Some stores block reading. That's no dead end: when adding, take a
      // name from the words in the link if it has one, as the website does.
      const guess = mode === "add" && !title.trim() && source ? nameFromProductUrl(source) : undefined;
      if (guess) setTitle(guess);
      if (mode === "add" && (guess || title.trim())) chooseGuessedCategory(guess || title);
      setGuessedName(Boolean(guess));
      setFailedWithName(Boolean(title.trim()));
      return;
    }
    haptic("success");
    // A short link is swapped for the page it led to, below.
    const readFrom = source && product.url && isShortLink(source) ? product.url : source;
    if (readFrom) setReadGtin({ url: readFrom, gtin: product.gtin });
    if (source && product.url && isShortLink(source)) {
      setLink(product.url);
      lastReadUrl.current = product.url;
    }
    if (mode === "edit") {
      void fillInEdit(product, readFrom);
      return;
    }
    let filledAny = false;
    if (product.title && (!titleTouched || !title.trim())) {
      if (product.title !== title) filledAny = true;
      setTitle(product.title);
      // The website's add dialog guesses a category the same way.
      chooseGuessedCategory(product.title, product.storeCategory);
    }
    if (product.price != null && (!priceTouched || !priceText.trim())) {
      setPriceText(product.price.toFixed(2));
      setTaxInfo(null);
      if (bought) addTax(product.price);
      filledAny = true;
    }
    if (product.images.length > 0) {
      setImages(product.images);
      if (imageUrl !== product.images[0]) filledAny = true;
      setImageUrl(product.images[0]);
    }
    setReadState(filledAny ? "done" : "nothing");
  }

  /**
   * Editing: a link to another product replaces the name, price and photo,
   * keeping what they were for Undo. The same link again only refreshes the
   * price and fills in what's empty. The website's edit dialog does the same
   * (src/components/edit-item-dialog.tsx).
   */
  async function fillInEdit(product: ReadProduct, readFrom: string | null) {
    const newProduct = readFrom !== detailsFrom.current;
    detailsFrom.current = readFrom;
    const was: Replaced = { ...NOTHING_REPLACED };
    let changedAny = false;

    if (product.title && product.title !== title && (newProduct || !title.trim())) {
      if (title.trim()) was.title = title;
      setTitle(product.title);
      changedAny = true;
    }
    if (product.price != null) {
      let nextPrice = product.price.toFixed(2);
      let nextTax: { original: string; rate: number } | null = null;
      // Sales tax goes on what the owner already bought, when the list has a zip code.
      if (item?.is_parent_purchased && zipCode) {
        const result = await estimateTax(zipCode, product.price).catch(() => null);
        if (result) {
          nextTax = { original: nextPrice, rate: result.taxRate };
          nextPrice = result.priceWithTax;
        }
      }
      if (!samePrice(nextPrice, priceText)) {
        if (priceText.trim()) was.price = priceText;
        setPriceText(nextPrice);
        setTaxInfo(nextTax);
        changedAny = true;
      }
    }
    if (product.images.length > 0) {
      setImages(product.images);
      if (product.images[0] !== imageUrl && (newProduct || !imageUrl)) {
        if (imageUrl) was.imageUrl = imageUrl;
        setImageUrl(product.images[0]);
        changedAny = true;
      }
    }
    // Reading the same link twice keeps what the first read replaced, so Undo
    // still goes back to the owner's own values.
    setReplaced((before) =>
      newProduct
        ? was
        : { title: before.title ?? was.title, price: before.price ?? was.price, imageUrl: before.imageUrl ?? was.imageUrl }
    );
    if (changedAny) filledFrom.current = readFrom;
    setReadState(filledFrom.current === readFrom ? "done" : "nothing");
  }

  /**
   * Adds estimated sales tax to the price of what the owner bought, as the
   * website's add and edit dialogs do. Adding goes by the "bought" switch.
   * Editing goes by whether the saved item is marked bought.
   */
  async function addTax(price: number) {
    if (!zipCode) return;
    const result = await estimateTax(zipCode, price).catch(() => null);
    if (!result) return;
    setPriceText(result.priceWithTax);
    setTaxInfo({ original: price.toFixed(2), rate: result.taxRate });
  }
  const taxApplies = mode === "edit" ? Boolean(item?.is_parent_purchased) : bought;

  /** Puts the item on another of the owner's lists as well. The form stays open. */
  function addToAnotherList(list: { id: string; title: string }) {
    if (!item) return;
    setError(null);
    setNotice(null);
    addToList.mutate(
      { item, listId: list.id, listTitle: list.title },
      {
        onSuccess: () => {
          haptic("success");
          setAddedTo((lists) => [...lists, list]);
          setNotice(`Added to ${list.title}.`);
          setPlacing(null);
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
  }

  /** Moves the item to another list. It leaves this one, so the form closes. */
  function moveToAnotherList(list: { id: string; title: string }) {
    if (!item) return;
    setError(null);
    setNotice(null);
    moveToList.mutate(
      { item, listId: list.id },
      {
        onSuccess: () => {
          haptic("success");
          onDone({ type: "deleted", registryId: item.registry_id });
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
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
      gtin: readGtin?.gtin && link === readGtin.url ? readGtin.gtin : null,
      ...(mode === "add" && fromChecklist ? { checklist_entry: fromChecklist.entry } : {}),
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
      void addNew(registryId);
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

  /** Adds the item, after making a guessed category the list doesn't have yet. */
  async function addNew(registryId: string) {
    let categoryForItem = categoryId;
    if (suggestedCategory && categoryId === null) {
      try {
        const made = await createCategory.mutateAsync({ registryId, name: suggestedCategory });
        categoryForItem = made.id;
      } catch {
        // The item matters more than its category: save it without one.
      }
    }
    addItem.mutate(
      { registryId, input: { ...input(), category_id: categoryForItem } },
      {
        onSuccess: (added) => {
          haptic("success");
          onDone({ type: "added", registryId, title: added.title });
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
  }

  function confirmDelete() {
    if (!item) return;
    // The website's edit dialog asks the same (src/components/edit-item-dialog.tsx).
    const wording = removeItemWording({ title: item.title, otherLists });
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

  /**
   * Chooses the category that fits the item best (src/lib/item-categories.ts),
   * unless the owner already chose one: one of the list's, or a new one made
   * when the item is saved.
   */
  function chooseGuessedCategory(name: string, storeCategory?: string[]) {
    if (categoryTouched) return;
    const guess = suggestCategory({ title: name, storeCategory }, categories);
    if (!guess) return;
    setCategoryId(guess.id ?? null);
    setSuggestedCategory(guess.id ? null : guess.name);
  }

  function addCategory() {
    const name = newCategory?.trim();
    if (!name || !registryId) return;
    createCategory.mutate(
      { registryId, name },
      {
        onSuccess: (category) => {
          setCategoryId(category.id);
          setSuggestedCategory(null);
          setCategoryTouched(true);
          setNewCategory(null);
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
  }

  // Saving can first make a guessed category (addNew).
  const saving = addItem.isPending || (createCategory.isPending && newCategory === null);
  const store = storeLabel(link);
  const openUrl = normalizeLink(link);
  const saveTitle =
    mode === "edit" ? "Save changes" : duplicate && confirmedDuplicate ? "Add it again" : "Add item";

  return (
    <>
      {readingUrl ? <ProductReader key={readingUrl} url={readingUrl} onResult={onProduct} /> : null}
      <KeyboardScrollView
        bottomOffset={keyboardFooter.bottomOffset}
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
              Also on {listNames(otherLists)}. Changes show there too.
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
              if (!normalized || normalized === readingUrl) return;
              // Adding reads a link once. Editing reads it when it changed since the last read.
              if (mode === "add" ? readState === "idle" : normalized !== lastReadUrl.current) startReading(link);
            }}
            placeholder="Paste a product link"
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
                Or share a product to Regibee from a store's app or website.
              </Text>
            </View>
          ) : null}
          {mode === "edit" && openUrl && !readingUrl ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Button title="Read the page again" icon="refresh" size="small" variant="ghost" onPress={() => startReading(link)} />
              {savedLink && openUrl !== savedLink ? (
                <Button title="Keep the current link" size="small" variant="ghost" onPress={keepCurrentLink} />
              ) : null}
            </View>
          ) : null}
          {mode === "edit" && readingUrl && !photosOnly && savedLink && readingUrl !== savedLink ? (
            <View style={{ flexDirection: "row" }}>
              <Button title="Keep the current link" size="small" variant="ghost" onPress={keepCurrentLink} />
            </View>
          ) : null}
          <ReadStatus
            state={readState}
            store={store}
            failedWithName={failedWithName}
            guessedName={guessedName}
          />
          {linkedRegistries && registryId ? (
            <StoreLinkStatus
              link={link}
              registryId={registryId}
              linkedRegistries={linkedRegistries}
              registryLinkStores={registryLinkStores}
            />
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
          {replaced.imageUrl !== null ? (
            <WasLine
              center
              onUndo={() => {
                setImageUrl(replaced.imageUrl);
                setReplaced((r) => ({ ...r, imageUrl: null }));
              }}
            >
              New photo from {store ?? "the store"}.
            </WasLine>
          ) : null}
          {images.length > 1 ? (
            <Text variant="footnote" tone="tertiary" style={{ textAlign: "center" }}>
              Choose a photo
            </Text>
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
            {mode === "edit" && openUrl && store ? (
              <Button
                title={`Look for photos on ${store}`}
                icon="image"
                size="small"
                variant="ghost"
                loading={photosOnly}
                disabled={Boolean(readingUrl)}
                onPress={findPhotos}
              />
            ) : null}
          </View>
          {photoStatus ? (
            <Text variant="footnote" tone="tertiary" style={{ textAlign: "center" }} accessibilityLiveRegion="polite">
              {photoStatus}
            </Text>
          ) : null}
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
          {replaced.title !== null ? (
            <WasLine
              onUndo={() => {
                setTitle(replaced.title ?? "");
                setReplaced((r) => ({ ...r, title: null }));
              }}
            >
              Was “{replaced.title}”
            </WasLine>
          ) : null}
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
                  if (taxApplies && !taxInfo) addTax(value);
                }}
                hint={taxInfo ? `$${taxInfo.original} + ~${(taxInfo.rate * 100).toFixed(1)}% tax` : undefined}
                placeholder="0.00"
                keyboardType="decimal-pad"
                leading={<Text tone="tertiary">$</Text>}
              />
              {replaced.price !== null ? (
                <WasLine
                  onUndo={() => {
                    setPriceText(replaced.price ?? "");
                    setTaxInfo(null);
                    setReplaced((r) => ({ ...r, price: null }));
                  }}
                >
                  Was ${replaced.price}
                </WasLine>
              ) : null}
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
                selected={categoryId === null && suggestedCategory === null}
                onPress={() => {
                  setCategoryId(null);
                  setSuggestedCategory(null);
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
                    setSuggestedCategory(null);
                    setCategoryTouched(true);
                  }}
                />
              ))}
              {suggestedCategory !== null ? (
                <Chip label={`${suggestedCategory} (new)`} selected={categoryId === null} onPress={() => setCategoryId(null)} />
              ) : null}
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
            value={mostWanted}
            onValueChange={setMostWanted}
          />
          <Divider inset={52} />
          <SwitchRow
            icon="checkCircle"
            // The website's add dialog says "Mark as bought by parent", and its edit dialog "Purchased by parent".
            label={
              mode === "edit"
                ? copyForRegistry(detail.data?.registry).selfPurchasedLabel
                : copyForRegistry(detail.data?.registry).selfPurchaseButton
            }
            description={mode === "edit" ? "Guests can pay you back instead." : undefined}
            value={bought}
            onValueChange={setBought}
          />
          <Divider inset={52} />
          <SwitchRow
            icon="refresh"
            label="Open to hand-me-downs"
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

        {/* Which baby checklist entry it counts for, as in the website's edit
            dialog. Choosing saves at once, apart from the form. */}
        {mode === "edit" && item && registryId && checklistShown ? (
          <Section>
            <NavRow
              icon="checklist"
              label="Checklist"
              detail={checklistEntry(countedEntry(checklistItem).key)?.entry.name ?? "Not counted"}
              onPress={() =>
                router.push({ pathname: "/registry/[id]/checklist-entry", params: { id: registryId, thing: item.id, kind: "item" } })
              }
            />
          </Section>
        ) : null}

        {mode === "edit" && item ? <ItemGifts item={item} /> : null}

        {/* The website's edit dialog keeps these in its More actions menu. */}
        {listsToOffer.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Button
                title="Add to another list"
                icon="add"
                size="small"
                variant={placing === "add" ? "primary" : "secondary"}
                onPress={() => setPlacing(placing === "add" ? null : "add")}
              />
              <Button
                title="Move to another list"
                icon="arrowUp"
                size="small"
                variant={placing === "move" ? "primary" : "secondary"}
                onPress={() => setPlacing(placing === "move" ? null : "move")}
              />
            </View>
            {placing ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="footnote" tone="secondary">
                  {placing === "add"
                    ? "Add it to which list as well?"
                    : "Move it to which list? Its gifts go with it."}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, opacity: addToList.isPending || moveToList.isPending ? 0.5 : 1 }}>
                  {listsToOffer.map((list) => (
                    <Chip
                      key={list.id}
                      label={list.title}
                      selected={false}
                      onPress={() => {
                        if (addToList.isPending || moveToList.isPending) return;
                        if (placing === "add") addToAnotherList(list);
                        else moveToAnotherList(list);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        {notice ? (
          <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}

        {mode === "edit" && item ? (
          <Button
            title={removeItemWording({ title: item.title, otherLists }).button}
            variant="danger"
            icon="trash"
            onPress={confirmDelete}
          />
        ) : null}
      </KeyboardScrollView>

      <KeyboardFooter
        {...keyboardFooter.footerProps}
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
      </KeyboardFooter>
    </>
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

/** "Was $32.99 · Undo", under a field that reading a link changed. */
function WasLine({ children, onUndo, center }: { children: ReactNode; onUndo: () => void; center?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: center ? "center" : "flex-start" }}>
      <Text variant="footnote" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
        {children}
      </Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => {
          haptic();
          onUndo();
        }}
        style={({ pressed }) => ({ minHeight: 32, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
      >
        <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
          Undo
        </Text>
      </Pressable>
    </View>
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
 * registry link, a plain link at a store where the owner has a registry, and
 * a link at a store where they might have one they haven't linked.
 */
function StoreLinkStatus({
  link,
  registryId,
  linkedRegistries,
  registryLinkStores,
}: {
  link: string;
  registryId: string;
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
          Gifts bought through it count toward your registry.
        </Text>
      </View>
    );
  }

  // Only warn when the owner has a registry at this store. Otherwise the
  // warning would be noise.
  const linked = linkedRegistries.find((r) => r.store === store.id);
  if (!linked && !registryLinkStores.includes(store.id)) {
    // The website opens Settings in a new tab and keeps the dialog. Here
    // Settings is another screen, so ask before leaving the form.
    const openSettings = () =>
      Alert.alert("Leave this item?", "What you've typed here isn't saved yet.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => {
            router.back();
            router.push({ pathname: "/registry/[id]/settings", params: { id: registryId } });
          },
        },
      ]);
    return (
      <View style={[styles.notice, { backgroundColor: theme.tintSoft }]} accessibilityLiveRegion="polite">
        <Icon name="store" size={16} color={theme.tint} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text variant="footnote">
            <Text variant="footnote" style={{ fontWeight: "600" }}>
              Have a {store.name} registry?
            </Text>{" "}
            Link it so gifts bought there count toward it.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md, rowGap: spacing.xs }}>
            <Button title={`Link ${store.name} registry`} variant="secondary" size="small" onPress={openSettings} />
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setDismissedFor(link)}
              style={({ pressed }) => ({ minHeight: 36, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  if (kind !== "plain") return null;

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
function ReadStatus({
  state,
  store,
  failedWithName,
  guessedName,
}: {
  state: ReadState;
  store: string | null;
  failedWithName: boolean;
  /** The name was taken from the words in the link. */
  guessedName: boolean;
}) {
  const theme = useTheme();
  if (state === "idle") return null;
  if (state === "reading") {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={theme.tint} />
        <Text variant="footnote" tone="secondary">
          Reading the page…
        </Text>
      </View>
    );
  }
  if (state === "done" || state === "nothing") {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Icon name="checkCircle" size={16} color={theme.success} />
        <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
          {state === "done"
            ? `Filled in from ${store ?? "this link"}. Check it over.`
            : `Nothing new to fill in from ${store ?? "this link"}.`}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Icon name="error" size={16} color={theme.textTertiary} />
      <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
        We couldn&apos;t read the details from {store ?? "this link"}
        {guessedName
          ? ". Check the name and fill in the rest."
          : failedWithName
            ? ". Fill in the rest yourself."
            : ". Add the name and the rest yourself."}
      </Text>
    </View>
  );
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
