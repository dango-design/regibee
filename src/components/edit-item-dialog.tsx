"use client";

import { startTransition, useEffect, useId, useOptimistic, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { Camera, Check, CornerUpRight, DollarSign, ExternalLink, ImagePlus, Images, Info, ListPlus, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Clipboard, DotsHorizontal, Link01 } from "@untitledui/icons";
import { Button as AriaButton, SubmenuTrigger } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Input, InputBase } from "@/components/base/input/input";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { InputGroup } from "@/components/base/input/input-group";
import { Label } from "@/components/base/input/label";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { CategoryField } from "@/components/category-field";
import { ChecklistEntryField } from "@/components/checklist-entry-picker";
import { TextArea } from "@/components/base/textarea/textarea";
import { Select } from "@/components/base/select/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCategory,
  deleteRegistryItem,
  toggleParentPurchased,
  updateRegistryItem,
} from "@/lib/actions/registry";
import { addItemsToList, moveItemToList } from "@/lib/actions/saved";
import { setPriceChecks } from "@/lib/actions/item-details";
import { fetchProductDetails } from "@/lib/fetch-product";
import { gtinForLink, type ReadGtin } from "@/lib/gtin";
import { estimateTax } from "@/lib/actions/tax";
import { copyFor } from "@/lib/registry-copy";
import { findSharedLink } from "@/lib/shared-link";
import type { PersonalEventType, RegistryType } from "@/lib/types";
import { classifyStoreLink, type RetailerRegistry, type StoreId } from "@/lib/retailers";
import { cn } from "@/lib/utils";
import { StoreLinkNotice } from "@/components/store-link-notice";
import { ItemImage } from "@/components/item-image";
import { readLinkMessages, storeNameForLink } from "@/components/add-item-dialog";
import { uploadRegistryPhoto } from "@/lib/upload-registry-photo";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

interface Category {
  id: string;
  name: string;
}

interface OwnerList {
  id: string;
  title: string;
}

interface EditItemDialogProps {
  item: {
    id: string;
    title: string;
    external_url: string | null;
    image_url: string | null;
    price: number | null;
    quantity_needed: number;
    quantity_fulfilled: number;
    is_essential: boolean;
    is_parent_purchased: boolean;
    is_open_to_used: boolean;
    minimum_condition: string | null;
    notes: string | null;
    category_id: string | null;
    /** The baby checklist entry it counts for (src/lib/checklist-matching.ts). */
    checklist_entry?: string | null;
    /** Whether the list's page checks its price weekly. Missing when that doesn't apply (src/lib/item-details.ts). */
    priceChecks?: "on" | "off";
  };
  registryId: string;
  categories: Category[];
  zipCode?: string;
  registryType?: RegistryType;
  eventType?: PersonalEventType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The owner's linked store registries. Leave unset to hide store notices. */
  linkedRegistries?: RetailerRegistry[];
  /** Stores that other items on this registry have registry links from. */
  storesWithRegistryLinks?: StoreId[];
  /**
   * The titles of the owner's other lists this item is on. Then changes show
   * on those lists too, and removing it here keeps it there.
   */
  otherLists?: string[];
  /** The ids of those lists. */
  otherListIds?: string[];
  /**
   * The owner's other lists. The menu offers to add the item to one it isn't
   * on, or move it there. Leave unset for co-managers, who can't do either.
   */
  ownerLists?: OwnerList[];
  /**
   * Photos to offer as soon as the dialog opens. The dialog finds them itself
   * by reading the link, which stories can't do, so stories pass them.
   */
  photosToOffer?: string[];
}

/** What reading a link replaced, so the owner can undo each change. */
interface Replaced {
  title: string | null;
  price: string | null;
  imageUrl: string | null;
}

const NOTHING_REPLACED: Replaced = { title: null, price: null, imageUrl: null };

// The lowest condition an owner will take a hand-me-down in. The database
// column is still minimum_condition, from when the site said "used".
const CONDITIONS = [
  { id: "like-new", label: "Like new" },
  { id: "very-good", label: "Very good" },
  { id: "good", label: "Good" },
  { id: "acceptable", label: "Acceptable" },
];

/** "Wishlist", "Wishlist and Birthday", "Wishlist, Birthday and 2 more". */
function listNames(titles: string[]): string {
  if (titles.length <= 2) return titles.join(" and ");
  return `${titles[0]}, ${titles[1]} and ${titles.length - 2} more`;
}

/** The link with http:// added when it has no scheme, as saving does. */
function withScheme(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

/** The link without its scheme and www, for showing in the one-line bar. */
function shortLink(url: string): string {
  return url.trim().replace(/^https?:\/\/(www\.)?/i, "");
}

/**
 * The link as typed, ready to open in a new tab, or null when it isn't a web
 * link. A link typed without https:// gets it. Saving adds http:// instead,
 * and stores redirect that to https:// anyway.
 */
function openableLink(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const scheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(scheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    // Opened as typed, so the store's registry params stay exactly as they are.
    return scheme;
  } catch {
    return null;
  }
}

/** A guest option the owner turns on or off, like Most wanted. */
function TogglePill({
  pressed,
  onPress,
  children,
}: {
  pressed: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const Icon = pressed ? Check : Plus;
  return (
    <AriaButton
      aria-pressed={pressed}
      onPress={onPress}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-semibold outline-brand transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 pressing:scale-[0.97] max-sm:min-h-11",
        pressed
          ? "border-brand bg-brand-primary text-brand-secondary hover:bg-brand-secondary"
          : "border-primary bg-primary text-secondary hover:bg-primary_hover pressing:bg-tertiary",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </AriaButton>
  );
}

// A button that reads as a link, like Undo. It darkens and underlines under
// the pointer and while pressed, as the shared Button's link variant does.
const textButton =
  "cursor-pointer rounded font-semibold text-brand-secondary underline decoration-transparent underline-offset-2 outline-brand transition duration-100 hover:text-brand-secondary_hover hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 active:text-brand-secondary_hover active:decoration-current";

// The buttons in the grey link bar. The shared Button's hover colour is the
// bar's own grey, so they get the next grey up, and one more while pressed.
const barButton = "hover:bg-secondary_hover pressing:bg-quaternary";

/** "Was $32.99 · Undo", under a field that reading a link changed. */
function WasLine({ children, onUndo }: { children: ReactNode; onUndo: () => void }) {
  return (
    <p className="flex min-w-0 items-center gap-1 text-xs text-tertiary">
      <span className="min-w-0 truncate">{children}</span>
      <button type="button" onClick={onUndo} className={cn(textButton, "shrink-0 px-1 max-sm:min-h-11 max-sm:px-2")}>
        Undo
      </button>
    </p>
  );
}

/**
 * Editing an item. Most owners only paste a link and let it fill in the rest,
 * so the link leads: a big box when there's no link yet, while a link is read
 * and when it couldn't be. Once the details are filled in, it steps back to
 * one line with a Change link button. A new link replaces the name, price and
 * photo, and each change can be undone.
 */
export function EditItemDialog({
  item,
  registryId,
  categories: initialCategories,
  zipCode,
  registryType = "baby",
  eventType = null,
  open,
  onOpenChange,
  linkedRegistries,
  storesWithRegistryLinks,
  otherLists = [],
  otherListIds = [],
  ownerLists = [],
  photosToOffer = [],
}: EditItemDialogProps) {
  const isBaby = registryType === "baby";
  const copy = copyFor({ registryType, eventType });
  const uid = useId();
  // True from Save until the dialog closes or shows an error. The form's
  // action runs in a transition, where a plain state change wouldn't show
  // until the action ends, so "Saving..." would never appear.
  const [loading, setLoading] = useOptimistic(false);
  const [deleting, setDeleting] = useState(false);
  // Removing the item asks first, in a dialog over this one. It shows the
  // error if the remove fails.
  const [askingDelete, setAskingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Adding the item to another list, or moving it there, is under way.
  const [placing, setPlacing] = useState(false);
  // Lists it was added to since the dialog opened. The page's own list of
  // them arrives a moment after the action returns.
  const [addedTo, setAddedTo] = useState<OwnerList[]>([]);
  const [notice, setNotice] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [scrapeIsError, setScrapeIsError] = useState(false);
  const [error, setError] = useState("");
  const [mostWanted, setMostWanted] = useState(item.is_essential);
  const [openToUsed, setOpenToUsed] = useState(item.is_open_to_used);
  const [condition, setCondition] = useState(item.minimum_condition || "like-new");
  const [parentPurchased, setParentPurchased] = useState(item.is_parent_purchased);
  const [priceChecksOn, setPriceChecksOn] = useState(item.priceChecks === "on");
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(item.price != null ? item.price.toFixed(2) : "");
  const [imageUrl, setImageUrl] = useState(item.image_url || "");
  const [externalUrl, setExternalUrl] = useState(item.external_url || "");
  const [taxInfo, setTaxInfo] = useState<{ original: string; rate: number } | null>(null);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [categoryId, setCategoryId] = useState<string | undefined>(
    item.category_id ?? undefined,
  );
  // The owner asked to change the link. An item without one starts that way.
  const [linkOpen, setLinkOpen] = useState(!item.external_url);
  // The link before Change link, so Keep the current link can put it back.
  const [linkBefore, setLinkBefore] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<Replaced>(NOTHING_REPLACED);
  const [imageCandidates, setImageCandidates] = useState<string[]>(photosToOffer);
  const [brokenCandidates, setBrokenCandidates] = useState<Set<string>>(new Set());
  const [showImageLink, setShowImageLink] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Looking on the store's page for photos only, from the photo's menu.
  const [findingPhotos, setFindingPhotos] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const photoRead = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageLinkRef = useRef<HTMLInputElement>(null);

  const urlRef = useRef<HTMLInputElement>(null);
  const openUrl = openableLink(externalUrl);
  const savedLink = item.external_url ? withScheme(item.external_url.trim()) : null;
  // Weekly price checks, for the saved link. A new link starts with checks on,
  // and a bought item's price is what the owner paid, so neither shows it.
  const showPriceChecks =
    item.priceChecks !== undefined &&
    !parentPurchased &&
    savedLink !== null &&
    externalUrl.trim() !== "" &&
    withScheme(externalUrl.trim()) === savedLink;
  // Reading a link can take many seconds, and the owner may close the dialog
  // meanwhile. Each read takes the next number. Closing the dialog moves the
  // number on, so a read that finishes after that leaves the form alone.
  const readNumber = useRef(0);
  const isOpen = useRef(open);
  // The link last read, so leaving the field doesn't read the same link again.
  const lastReadUrl = useRef<string | null>(null);
  // The link the name, price and photo came from. Reading another link
  // replaces them. Reading this one again only refreshes the price.
  const detailsFrom = useRef<string | null>(null);
  // The link the photo choices came from.
  const picturesFrom = useRef<string | null>(null);
  // The last link whose read changed something.
  const filledFrom = useRef<string | null>(null);
  // A barcode number read here, and its link. It's sent only with that link.
  // Without one, the server keeps the saved barcode if the link stays
  // (src/lib/gtin.ts).
  const readGtin = useRef<ReadGtin | null>(null);

  useEffect(() => {
    isOpen.current = open;
    if (open) {
      // The details on file came from the saved link, so leaving the link
      // field without changing it doesn't read it again.
      lastReadUrl.current = savedLink;
      detailsFrom.current = savedLink;
    }
  }, [open, savedLink]);

  const canPaste = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
  const linkBig = linkOpen || !externalUrl.trim() || scraping || scrapeIsError;
  const storeName = externalUrl.trim() ? storeNameForLink(withScheme(externalUrl.trim())) : "";
  const isRegistryLink = classifyStoreLink(externalUrl)?.kind === "registry";
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const photoChoices = imageCandidates.filter((c) => !brokenCandidates.has(c));

  const handlePriceChange = (val: string) => {
    setPrice(val);
    setTaxInfo(null);
  };

  const handlePriceBlur = async () => {
    if (!price) return;
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed <= 0) return;
    if (!item.is_parent_purchased || !zipCode || taxInfo) {
      setPrice(parsed.toFixed(2));
      return;
    }
    const result = await estimateTax(zipCode, parsed);
    if (result) {
      setPrice(result.priceWithTax);
      setTaxInfo({ original: parsed.toFixed(2), rate: result.taxRate });
    } else {
      setPrice(parsed.toFixed(2));
    }
  };

  /**
   * Reads the link. A link to another product replaces the name, price and
   * photo, keeping what they were for Undo. The same link again only
   * refreshes the price and fills in what's empty. `fromTap` is true for
   * Fetch details, Enter and pasting. Leaving the field reads the link only
   * when it changed since the last read.
   */
  const handleScrape = async (rawUrl: string, options: { fromTap?: boolean } = {}) => {
    // Leaving the field calls this too, so it can run as the dialog closes.
    if (!rawUrl.trim() || scraping || !isOpen.current) return;
    const url = withScheme(rawUrl.trim());

    try {
      new URL(url);
    } catch {
      return;
    }
    if (!options.fromTap && url === lastReadUrl.current) return;
    lastReadUrl.current = url;
    const newProduct = url !== detailsFrom.current;

    // Pictures from another link show another product.
    if (picturesFrom.current && picturesFrom.current !== url) {
      setImageCandidates([]);
      setBrokenCandidates(new Set());
      picturesFrom.current = null;
    }

    const run = ++readNumber.current;
    const stillCurrent = () => run === readNumber.current;
    setScraping(true);
    setScrapeStatus("");
    setScrapeIsError(false);
    if (newProduct) setReplaced(NOTHING_REPLACED);

    const result = await fetchProductDetails(url, {
      onReadingWithExtension: () => {
        if (stillCurrent()) setScrapeStatus("Reading the page in a background tab…");
      },
    });
    if (!stillCurrent()) return;

    const store = storeNameForLink(url);
    if (result.error) {
      // Worded as the add dialog, which explains why: some stores block
      // reading. The box stays big so the owner sees it.
      setScrapeStatus(readLinkMessages.failed(store, Boolean(title.trim())));
      setScrapeIsError(true);
      setScraping(false);
      return;
    }

    readGtin.current = { url, gtin: result.gtin ?? null };
    detailsFrom.current = url;
    const was: Replaced = { ...NOTHING_REPLACED };
    let changedAny = false;

    if (result.title && result.title !== title && (newProduct || !title.trim())) {
      if (title.trim()) was.title = title;
      setTitle(result.title);
      changedAny = true;
    }
    if (result.price) {
      let nextPrice = parseFloat(result.price).toFixed(2);
      let nextTax: { original: string; rate: number } | null = null;
      if (item.is_parent_purchased && zipCode) {
        const taxResult = await estimateTax(zipCode, parseFloat(result.price));
        if (!stillCurrent()) return;
        if (taxResult) {
          nextTax = { original: nextPrice, rate: taxResult.taxRate };
          nextPrice = taxResult.priceWithTax;
        }
      }
      if (nextPrice !== price) {
        if (price.trim()) was.price = price;
        setPrice(nextPrice);
        setTaxInfo(nextTax);
        changedAny = true;
      }
    }
    const candidates = result.imageUrls ?? (result.imageUrl ? [result.imageUrl] : []);
    if (candidates.length > 0) {
      setImageCandidates(candidates);
      setBrokenCandidates(new Set());
      picturesFrom.current = url;
      if (candidates[0] !== imageUrl && (newProduct || !imageUrl)) {
        if (imageUrl) was.imageUrl = imageUrl;
        setImageUrl(candidates[0]);
        changedAny = true;
      }
    }

    // Pasting and then pressing Fetch details reads the same link twice.
    // The second read keeps what the first replaced, so Undo still goes back
    // to the owner's own values, and the message still says it filled them.
    setReplaced((before) =>
      newProduct
        ? was
        : {
            title: before.title ?? was.title,
            price: before.price ?? was.price,
            imageUrl: before.imageUrl ?? was.imageUrl,
          },
    );
    if (changedAny) filledFrom.current = url;
    setScrapeStatus(
      filledFrom.current === url ? readLinkMessages.filled(store) : readLinkMessages.nothingNew(store),
    );
    // The details came from the page, so the link steps back to one line.
    setLinkOpen(false);
    setLinkBefore(null);
    setScraping(false);
  };

  /** Pastes from the clipboard and reads the link, for the Paste link button on phones. */
  const handlePaste = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // The browser refused, or the owner said no. Leave them the field to
      // paste into themselves.
      urlRef.current?.focus();
      return;
    }
    const shared = findSharedLink({ text });
    if (!shared) {
      setScrapeStatus("There's no link on your clipboard.");
      setScrapeIsError(true);
      return;
    }
    setExternalUrl(shared.url);
    void handleScrape(shared.url, { fromTap: true });
  };

  /** Pasting a link over the whole field reads it straight away. */
  const handleFieldPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const replacesAll =
      !field.value || (field.selectionStart === 0 && field.selectionEnd === field.value.length);
    if (!replacesAll) return;
    const shared = findSharedLink({ text: event.clipboardData.getData("text") });
    if (!shared) return;
    event.preventDefault();
    setExternalUrl(shared.url);
    void handleScrape(shared.url, { fromTap: true });
  };

  /**
   * Looks on the store's page for photos, and changes nothing else. The owner
   * picks one of them. With no photo yet, the first one is used.
   */
  const findPhotos = async () => {
    const url = withScheme(externalUrl.trim());
    if (!openUrl || findingPhotos) return;
    const run = ++photoRead.current;
    setFindingPhotos(true);
    setPhotoStatus("");
    setUploadError(null);
    const result = await fetchProductDetails(url);
    if (run !== photoRead.current) return;
    setFindingPhotos(false);
    const store = storeNameForLink(url);
    const found = result.error ? [] : (result.imageUrls ?? (result.imageUrl ? [result.imageUrl] : []));
    if (found.length === 0) {
      setPhotoStatus(
        result.error
          ? `We couldn't read ${store}'s page.`
          : `We found no photos on ${store}'s page.`,
      );
      return;
    }
    setImageCandidates(found);
    setBrokenCandidates(new Set());
    picturesFrom.current = url;
    if (!imageUrl) setImageUrl(found[0]);
    else if (found.length === 1 && found[0] === imageUrl) setPhotoStatus(`${store} has only this photo.`);
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setPhotoStatus("");
    const result = await uploadRegistryPhoto(registryId, file);
    if ("error" in result) {
      setUploadError(result.error);
    } else {
      setImageUrl(result.url);
      setShowImageLink(false);
    }
    setUploading(false);
  };

  const choosePhotoAction = (action: string) => {
    if (action === "upload") fileRef.current?.click();
    if (action === "find") void findPhotos();
    if (action === "link") {
      setShowImageLink(true);
      requestAnimationFrame(() => imageLinkRef.current?.focus());
    }
  };

  /** Makes a category from the Category field and puts the item in it. */
  const addCategory = async (name: string): Promise<string | null> => {
    const result = await createCategory(registryId, name);
    if (result?.error) return result.error;
    if (result?.category) {
      const made = result.category;
      setCategories((before) => (before.some((c) => c.id === made.id) ? before : [...before, made]));
      setCategoryId(made.id);
    }
    return null;
  };

  const changeLink = () => {
    setLinkBefore(externalUrl);
    setLinkOpen(true);
    setScrapeStatus("");
    setScrapeIsError(false);
    // Selected, so pasting replaces it.
    requestAnimationFrame(() => {
      urlRef.current?.focus();
      urlRef.current?.select();
    });
  };

  /** Reads the saved link again, say to pick up a new price. */
  const readAgain = () => {
    setLinkBefore(externalUrl);
    void handleScrape(externalUrl, { fromTap: true });
  };

  /** Puts back the link from before Change link, and stops a read under way. */
  const keepCurrentLink = () => {
    if (linkBefore === null) return;
    readNumber.current++;
    setScraping(false);
    setExternalUrl(linkBefore);
    lastReadUrl.current = linkBefore.trim() ? withScheme(linkBefore.trim()) : null;
    setLinkBefore(null);
    setLinkOpen(!linkBefore.trim());
    setScrapeStatus("");
    setScrapeIsError(false);
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");
    // Prepend protocol if the visual http:// prefix was relied on
    for (const field of ["externalUrl", "imageUrl"]) {
      const val = formData.get(field) as string;
      if (val && !/^https?:\/\//i.test(val)) {
        formData.set(field, `http://${val}`);
      }
    }
    formData.set("gtin", gtinForLink(readGtin.current, formData.get("externalUrl") as string | null));
    const result = await updateRegistryItem(item.id, registryId, formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    // Apply the self-purchase toggle via the dedicated action if it changed.
    if (parentPurchased !== item.is_parent_purchased) {
      await toggleParentPurchased(item.id, registryId, parentPurchased);
    }
    if (showPriceChecks && priceChecksOn !== (item.priceChecks === "on")) {
      const checks = await setPriceChecks(registryId, item.id, priceChecksOn).catch(() => ({
        error: "Couldn't save the price check setting. Try again.",
      }));
      if (checks?.error) {
        setError(checks.error);
        return;
      }
    }
    closeWithNewPage(() => setScrapeStatus(""));
  };

  /** Stops listening to a read still under way. */
  const dropRead = () => {
    readNumber.current++;
    lastReadUrl.current = null;
    detailsFrom.current = null;
    filledFrom.current = null;
    readGtin.current = null;
    setScraping(false);
    photoRead.current++;
    setFindingPhotos(false);
  };

  /** Closes after saving or deleting. The form already shows the saved item, so it stays as it is. */
  const closeAfterSaving = () => {
    isOpen.current = false;
    dropRead();
    setLinkBefore(null);
    setReplaced(NOTHING_REPLACED);
    onOpenChange(false);
  };

  /**
   * Closes once the list behind the dialog shows the change. A save or delete
   * returns before the page's new items arrive. Closed right away, the list
   * would show the old photo and name, or the deleted item, until they do.
   * The dialog stays on "Saving..." or "Removing..." for that time instead.
   * This only works inside a transition that awaited the action: React then
   * shows these updates together with the page's.
   */
  const closeWithNewPage = (alsoDo: () => void) => {
    startTransition(() => {
      closeAfterSaving();
      alsoDo();
    });
  };

  // Back to the item as saved, so reopening the dialog starts fresh.
  const changeOpen = (next: boolean) => {
    isOpen.current = next;
    onOpenChange(next);
    if (next) return;
    dropRead();
    setScrapeStatus("");
    setScrapeIsError(false);
    setMostWanted(item.is_essential);
    setOpenToUsed(item.is_open_to_used);
    setCondition(item.minimum_condition || "like-new");
    setParentPurchased(item.is_parent_purchased);
    setPriceChecksOn(item.priceChecks === "on");
    setGuestInfoOpen(false);
    setError("");
    setNotice("");
    setAddedTo([]);
    setTitle(item.title);
    setPrice(item.price != null ? item.price.toFixed(2) : "");
    setImageUrl(item.image_url || "");
    setExternalUrl(item.external_url || "");
    setTaxInfo(null);
    setCategoryId(item.category_id ?? undefined);
    setLinkOpen(!item.external_url);
    setLinkBefore(null);
    setReplaced(NOTHING_REPLACED);
    setImageCandidates([]);
    setBrokenCandidates(new Set());
    picturesFrom.current = null;
    setShowImageLink(false);
    setUploadError(null);
    setPhotoStatus("");
  };

  // The other lists it's on: the ones the page knows of, then any just added.
  const justAdded = addedTo.filter((list) => !otherListIds.includes(list.id));
  const alsoOn = [...otherLists, ...justAdded.map((list) => list.title)];
  const onOtherLists = alsoOn.length > 0;
  // The owner's lists it isn't on yet.
  const listsToOffer = ownerLists.filter(
    (list) => list.id !== registryId && !otherListIds.includes(list.id) && !addedTo.some((added) => added.id === list.id),
  );

  /** Puts the item on another list as well. The dialog stays open. */
  const handleAddToList = (list: OwnerList) => {
    setError("");
    setNotice("");
    setPlacing(true);
    startTransition(async () => {
      const result = await addItemsToList([item.id], list.id);
      setPlacing(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setAddedTo((lists) => [...lists, list]);
      setNotice(`Added to ${list.title}.`);
    });
  };

  /** Moves the item to another list. It leaves this one, so the dialog closes. */
  const handleMoveToList = (list: OwnerList) => {
    setError("");
    setNotice("");
    setPlacing(true);
    startTransition(async () => {
      const result = await moveItemToList(item.id, registryId, list.id);
      if ("error" in result) {
        setError(result.error);
        setPlacing(false);
        return;
      }
      closeWithNewPage(() => setPlacing(false));
    });
  };

  const askToDelete = () => {
    setError("");
    setNotice("");
    setDeleteError("");
    setAskingDelete(true);
  };

  // Both dialogs stay open until the list behind them shows the change.
  const handleDelete = () => {
    setDeleteError("");
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteRegistryItem(item.id, registryId);
      if (result?.error) {
        setDeleteError(result.error);
        setDeleting(false);
        return;
      }
      closeWithNewPage(() => {
        setDeleting(false);
        setAskingDelete(false);
      });
    });
  };
  const removeLabel = onOtherLists ? "Remove from list" : "Remove item";
  const menuBusy = deleting || placing;
  /** Runs a choice from the More actions menu or one of its two lists. */
  const chooseMenuAction = (key: string) => {
    if (key === "remove") return askToDelete();
    const [action, listId] = key.split(":");
    const list = listsToOffer.find((l) => l.id === listId);
    if (!list) return;
    if (action === "add") handleAddToList(list);
    if (action === "move") handleMoveToList(list);
  };
  // The info button shows these under the pointer, and in a box when tapped.
  const guestHelp = [
    ["Most wanted", "tags it so guests spot it first."],
    ["Open to hand-me-downs", "lets guests give a used one."],
    [copy.selfPurchasedLabel, "means you bought it already. Guests can pay you back instead."],
  ];
  // One photo that's already the item's photo leaves nothing to pick.
  const showPhotoChoices = photoChoices.length > 1 || (photoChoices.length === 1 && photoChoices[0] !== imageUrl);
  const photoBusy = uploading || findingPhotos;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {/* grid-cols-1 keeps the one-line link from widening the sheet on phones. */}
      <DialogContent size="wide" className="max-h-[90vh] grid-cols-1 overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          {onOtherLists && (
            <DialogDescription>
              Also on {listNames(alsoOn)}. Changes show there too.
            </DialogDescription>
          )}
        </DialogHeader>
        <form action={handleSubmit} className="space-y-5">
          {/* The link, photo and guest options are buttons and boxes that
              come and go, so their values go with the form from here. */}
          <input type="hidden" name="externalUrl" value={externalUrl} />
          <input type="hidden" name="imageUrl" value={imageUrl} />
          <input type="hidden" name="isEssential" value={mostWanted ? "true" : ""} />
          <input type="hidden" name="isOpenToUsed" value={openToUsed ? "true" : ""} />

          {linkBig ? (
            <div className="space-y-2.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-primary p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Label className="!text-sm !font-semibold !text-primary">Paste a product link</Label>
                {linkBefore !== null && (
                  <button
                    type="button"
                    // Kept from taking focus, so leaving the field doesn't
                    // start reading the link this button puts back.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={keepCurrentLink}
                    className={cn(textButton, "text-sm max-sm:min-h-11")}
                  >
                    Keep the current link
                  </button>
                )}
              </div>
              {/* On phones the field takes the full width, with the buttons
                  below it sharing a row. */}
              <div className="flex items-stretch gap-2 max-sm:flex-col">
                <Input
                  ref={urlRef}
                  aria-label="Product link"
                  placeholder="https://www.target.com/..."
                  value={externalUrl}
                  onChange={setExternalUrl}
                  onBlur={(e) => handleScrape((e.target as HTMLInputElement).value)}
                  onPaste={handleFieldPaste}
                  onKeyDown={(e) => {
                    // Enter reads the link instead of saving the form.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleScrape(externalUrl, { fromTap: true });
                    }
                  }}
                  inputMode="url"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  enterKeyHint="go"
                  className="flex-1"
                />
                <div className="flex gap-2 max-sm:*:flex-1">
                  {/* Pasting into a field is fiddly on a phone, so offer a
                      button on touch screens and narrow windows. */}
                  {canPaste && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={scraping}
                      onClick={handlePaste}
                      className="hidden h-10 max-sm:inline-flex pointer-coarse:inline-flex"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Clipboard className="h-4 w-4" />
                        Paste link
                      </span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    disabled={scraping}
                    onClick={() => {
                      if (externalUrl.trim()) handleScrape(externalUrl, { fromTap: true });
                    }}
                    className="h-10"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link01 className="h-4 w-4" />}
                      {scraping ? "Reading…" : "Fetch details"}
                    </span>
                  </Button>
                </div>
              </div>
              {linkedRegistries && (
                <StoreLinkNotice
                  url={externalUrl}
                  registryId={registryId}
                  linkedRegistries={linkedRegistries}
                  storesWithRegistryLinks={storesWithRegistryLinks}
                />
              )}
              <p
                role="status"
                className={cn("text-xs", scrapeIsError ? "text-warning-primary" : scrapeStatus ? "text-brand-tertiary" : "text-tertiary")}
              >
                {scrapeStatus || (scraping ? "Reading the page…" : "")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-secondary bg-secondary py-1 pr-1 pl-3">
                {/* On phones the link itself is hidden, and the buttons move
                    to a second line when the store and badge need the room. */}
                <div className="flex min-w-0 items-center gap-2 max-sm:flex-auto sm:flex-1">
                  <Link01 className="h-4 w-4 shrink-0 text-fg-quaternary max-sm:hidden" aria-hidden="true" />
                  <span className="shrink-0 text-sm font-semibold text-primary">{storeName}</span>
                  {isRegistryLink && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success-200 dark:border-success-800 bg-success-primary px-2 py-0.5 text-xs font-semibold text-success-800 dark:text-success-300">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Registry link
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-tertiary max-sm:hidden" title={externalUrl}>
                    {shortLink(externalUrl)}
                  </span>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={readAgain}
                    title="Read the page again"
                    className={cn("size-9", barButton)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!openUrl}
                    onClick={() => {
                      if (openUrl) window.open(openUrl, "_blank", "noopener,noreferrer");
                    }}
                    title="Open link in a new tab"
                    className={cn("size-9", barButton)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={changeLink}
                    className={cn("h-9 px-3 text-brand-secondary hover:text-brand-secondary_hover", barButton)}
                  >
                    Change link
                  </Button>
                </div>
              </div>
              {scrapeStatus && (
                <p role="status" className="text-xs text-brand-tertiary">
                  {scrapeStatus}
                </p>
              )}
              {/* A registry link says so in the bar. The other notices warn
                  or explain, so they stay. */}
              {linkedRegistries && !isRegistryLink && (
                <StoreLinkNotice
                  url={externalUrl}
                  registryId={registryId}
                  linkedRegistries={linkedRegistries}
                  storesWithRegistryLinks={storesWithRegistryLinks}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="relative">
                <ItemImage
                  size="fill"
                  imageUrl={imageUrl || null}
                  title={title || item.title}
                  categoryName={categoryName}
                  className="h-40 md:h-64"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Cleared, so picking the same file again still uploads it.
                    event.target.value = "";
                    if (file) void uploadPhoto(file);
                  }}
                />
                {/* Owners rarely change a photo once there is one, so the
                    three ways to do it sit in a menu on the photo's corner. */}
                <Dropdown.Root>
                  <AriaButton
                    isDisabled={photoBusy}
                    className="absolute right-2 bottom-2 inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-primary/90 px-2.5 text-xs font-semibold text-secondary shadow-xs ring-1 ring-primary outline-brand backdrop-blur-sm transition duration-100 ring-inset hover:bg-primary hover:text-secondary_hover focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default pressing:scale-[0.97] max-sm:min-h-11 max-sm:px-3.5"
                  >
                    {photoBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {uploading ? "Uploading…" : findingPhotos ? "Looking…" : imageUrl ? "Change photo" : "Add photo"}
                  </AriaButton>
                  <Dropdown.Popover placement="bottom end" className="w-60">
                    <Dropdown.Menu
                      aria-label={imageUrl ? "Change photo" : "Add photo"}
                      selectionMode="none"
                      onAction={(key) => choosePhotoAction(String(key))}
                    >
                      <Dropdown.Item id="upload" icon={ImagePlus} label="Upload a photo" />
                      <Dropdown.Item id="link" icon={Link01} label="Paste an image link" />
                      {openUrl && storeName && <Dropdown.Item id="find" icon={Images} label={`Look for photos on ${storeName}`} />}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.Root>
              </div>
              {replaced.imageUrl !== null && (
                <WasLine
                  onUndo={() => {
                    setImageUrl(replaced.imageUrl ?? "");
                    setReplaced((r) => ({ ...r, imageUrl: null }));
                  }}
                >
                  New photo from {storeName}.
                </WasLine>
              )}
              {showPhotoChoices && (
                <div className="space-y-1.5">
                  {/* An item shows one photo, so say that these are choices. */}
                  <p id={`${uid}-photos`} className="text-xs text-tertiary">
                    Choose a photo
                  </p>
                  <div role="group" aria-labelledby={`${uid}-photos`} className="flex gap-2 overflow-x-auto p-0.5 pb-1">
                    {photoChoices.map((candidate, index) => {
                      const selected = candidate === imageUrl;
                      return (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => {
                            setImageUrl(candidate);
                            setPhotoStatus("");
                          }}
                          aria-label={`Photo ${index + 1}`}
                          aria-pressed={selected}
                          className={cn(
                            "relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-md bg-tertiary ring-2 transition duration-100 active:scale-[0.97]",
                            selected ? "ring-brand-solid" : "ring-transparent hover:ring-border-primary",
                          )}
                        >
                          <img
                            src={candidate}
                            alt=""
                            className={cn("size-full object-cover transition", !selected && "opacity-80 hover:opacity-100")}
                            onError={() =>
                              setBrokenCandidates((prev) => {
                                const next = new Set(prev);
                                next.add(candidate);
                                return next;
                              })
                            }
                          />
                          {selected && (
                            <span className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-brand-solid text-primary_on-brand">
                              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {photoStatus && (
                <p role="status" className="text-xs text-tertiary">
                  {photoStatus}
                </p>
              )}
              {uploadError && <p className="text-xs text-error-primary">{uploadError}</p>}
              {showImageLink && (
                <Input
                  ref={imageLinkRef}
                  label="Image link"
                  placeholder="https://www.example.com/photo.jpg"
                  value={imageUrl}
                  onChange={(url) => {
                    setImageUrl(url);
                    setUploadError(null);
                    setPhotoStatus("");
                  }}
                  inputMode="url"
                  autoComplete="off"
                />
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="space-y-1.5">
                <Input
                  label="Item name"
                  name="title"
                  placeholder={isBaby ? "e.g., Convertible Crib" : "e.g., Wireless Headphones"}
                  value={title}
                  onChange={setTitle}
                  isRequired
                />
                {replaced.title !== null && (
                  <WasLine
                    onUndo={() => {
                      setTitle(replaced.title ?? "");
                      setReplaced((r) => ({ ...r, title: null }));
                    }}
                  >
                    Was &ldquo;{replaced.title}&rdquo;
                  </WasLine>
                )}
              </div>

              {/* On phones the price gets most of the row and the category
                  its own. From md up, the three share one row. */}
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-x-3 gap-y-4 md:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)]">
                <div className="min-w-0 space-y-1.5">
                  <InputGroup
                    label="Price (optional)"
                    name="price"
                    value={price}
                    onChange={handlePriceChange}
                  >
                    <InputBase
                      icon={DollarSign}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      onBlur={handlePriceBlur}
                    />
                  </InputGroup>
                  {taxInfo && (
                    <p className="text-xs text-tertiary">
                      ${taxInfo.original} + ~{(taxInfo.rate * 100).toFixed(1)}% tax
                    </p>
                  )}
                  {replaced.price !== null && (
                    <WasLine
                      onUndo={() => {
                        setPrice(replaced.price ?? "");
                        setTaxInfo(null);
                        setReplaced((r) => ({ ...r, price: null }));
                      }}
                    >
                      Was $
                      {replaced.price}
                    </WasLine>
                  )}
                </div>
                <Input
                  label="Quantity"
                  name="quantityNeeded"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  defaultValue={item.quantity_needed.toString()}
                />
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <CategoryField
                    name="categoryId"
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    onCreate={addCategory}
                  />
                </div>
              </div>

              {showPriceChecks && (
                <Checkbox
                  isSelected={priceChecksOn}
                  onChange={setPriceChecksOn}
                  label="Check the store's price weekly"
                />
              )}

              {/* Which baby checklist entry it counts for, beside the item's other details. */}
              {isBaby && <ChecklistEntryField title={title} saved={item.checklist_entry} />}

              <TextArea
                label="Note for guests (optional)"
                name="notes"
                placeholder="Size, color, or anything else that helps"
                defaultValue={item.notes || ""}
                rows={3}
              />

              {/* Owners change these rarely, so they share one row. The info
                  button explains all three: under the pointer on a computer,
                  and in a box below when tapped, since a phone can't hover. */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-0.5">
                  <span id={`${uid}-guests`} className="text-sm font-medium text-secondary">
                    For guests
                  </span>
                  <Tooltip
                    isDisabled={guestInfoOpen}
                    delay={150}
                    title={
                      <span className="flex flex-col gap-1.5 py-0.5 font-normal">
                        {guestHelp.map(([name, what]) => (
                          <span key={name}>
                            <span className="font-semibold">{name}</span> {what}
                          </span>
                        ))}
                      </span>
                    }
                  >
                    {/* Negative margins keep the button's size from making
                        the row taller than the other fields' labels. */}
                    <AriaButton
                      aria-label="What these mean"
                      aria-expanded={guestInfoOpen}
                      aria-controls={`${uid}-guests-info`}
                      onPress={() => setGuestInfoOpen((shown) => !shown)}
                      className="-my-1.5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-fg-quaternary outline-brand transition duration-100 hover:bg-primary_hover hover:text-fg-secondary focus-visible:outline-2 pressing:bg-tertiary max-sm:-my-3 max-sm:size-11"
                    >
                      <Info className="h-4 w-4" aria-hidden="true" />
                    </AriaButton>
                  </Tooltip>
                </div>
                <div role="group" aria-labelledby={`${uid}-guests`} className="flex flex-wrap gap-1.5">
                  <TogglePill
                    pressed={mostWanted}
                    onPress={() => setMostWanted((on) => !on)}
                  >
                    Most wanted
                  </TogglePill>
                  <TogglePill
                    pressed={openToUsed}
                    onPress={() => setOpenToUsed((on) => !on)}
                  >
                    Open to hand-me-downs
                  </TogglePill>
                  <TogglePill
                    pressed={parentPurchased}
                    onPress={() => setParentPurchased((on) => !on)}
                  >
                    {copy.selfPurchasedLabel}
                  </TogglePill>
                </div>
                {guestInfoOpen && (
                  <div id={`${uid}-guests-info`} className="space-y-1 rounded-lg bg-secondary px-3 py-2.5 text-sm text-secondary">
                    {guestHelp.map(([name, what]) => (
                      <p key={name}>
                        <span className="font-semibold text-primary">{name}</span> {what}
                      </p>
                    ))}
                  </div>
                )}
                {openToUsed && (
                  <div className="max-w-60">
                    <Select
                      name="minimumCondition"
                      label="Minimum condition"
                      selectedKey={condition}
                      onSelectionChange={(key) => setCondition(key?.toString() || "like-new")}
                      items={CONDITIONS}
                    >
                      {(condItem) => <Select.Item id={condItem.id} label={condItem.label} />}
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-error-primary">{error}</p>}
          {notice && (
            <p role="status" className="text-sm text-tertiary">
              {notice}
            </p>
          )}

          {/* Most owners never move or remove an item here, so those actions
              sit in a menu behind three grey dots. Being small, the button
              fits a phone's sticky bar beside the other two. */}
          <DialogFooter sticky className="sm:items-center">
            <Dropdown.Root>
              <AriaButton
                aria-label="More actions"
                isDisabled={menuBusy}
                className={cn(
                  "mr-auto inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-tertiary outline-brand transition duration-100 hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default max-sm:size-11 max-sm:flex-none!",
                  barButton,
                )}
              >
                {menuBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <DotsHorizontal className="size-5 stroke-[3px]" aria-hidden="true" />
                )}
              </AriaButton>
              <Dropdown.Popover placement="top start" className="w-60">
                <Dropdown.Menu aria-label="More actions" selectionMode="none" onAction={(key) => chooseMenuAction(String(key))}>
                  {/* Both open a list of the owner's lists the item isn't on.
                      With none, only removing is left. */}
                  {listsToOffer.length > 0 && (
                    <SubmenuTrigger>
                      <Dropdown.Item id="add" icon={ListPlus} label="Add to another list" />
                      <Dropdown.Popover placement="end bottom" className="w-60">
                        <Dropdown.Menu
                          aria-label="Add to another list"
                          selectionMode="none"
                          onAction={(key) => chooseMenuAction(String(key))}
                        >
                          {listsToOffer.map((list) => (
                            <Dropdown.Item key={list.id} id={`add:${list.id}`} label={list.title} />
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </SubmenuTrigger>
                  )}
                  {listsToOffer.length > 0 && (
                    <SubmenuTrigger>
                      <Dropdown.Item id="move" icon={CornerUpRight} label="Move to another list" />
                      <Dropdown.Popover placement="end bottom" className="w-60">
                        <Dropdown.Menu
                          aria-label="Move to another list"
                          selectionMode="none"
                          onAction={(key) => chooseMenuAction(String(key))}
                        >
                          {listsToOffer.map((list) => (
                            <Dropdown.Item key={list.id} id={`move:${list.id}`} label={list.title} />
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </SubmenuTrigger>
                  )}
                  {listsToOffer.length > 0 && <Dropdown.Separator />}
                  <Dropdown.Item id="remove" icon={Trash2} destructive label={removeLabel} />
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {/* After the edit dialog's content, not inside it, so its form isn't
          inside the edit form. It opens on top. */}
      {onOtherLists ? (
        <ConfirmActionDialog
          open={askingDelete}
          onOpenChange={setAskingDelete}
          title={`Remove "${item.title}" from this list?`}
          description={`It stays on ${listNames(alsoOn)}.`}
          confirmLabel="Remove from list"
          working={deleting}
          error={deleteError}
          onConfirm={handleDelete}
        />
      ) : (
        <ConfirmDeleteDialog
          open={askingDelete}
          onOpenChange={setAskingDelete}
          title={`Delete "${item.title}"?`}
          description="This cannot be undone."
          phrase={null}
          confirmLabel="Delete item"
          working={deleting}
          error={deleteError}
          onConfirm={handleDelete}
        />
      )}
    </Dialog>
  );
}
