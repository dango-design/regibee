"use client";

import { startTransition, useEffect, useId, useOptimistic, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { Check, ExternalLink, Info, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Clipboard, Link01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Input, InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { CurrencySelect } from "@/components/currency-select";
import { Label } from "@/components/base/input/label";
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
import { PhotoUploadButton } from "@/components/photo-upload-button";
import { readLinkMessages, storeNameForLink } from "@/components/add-item-dialog";
import { uploadRegistryPhoto } from "@/lib/upload-registry-photo";

interface Category {
  id: string;
  name: string;
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

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
};

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
  title,
  children,
}: {
  pressed: boolean;
  onPress: () => void;
  /** What it does, shown when the pointer rests on it. The info button explains all of them. */
  title: string;
  children: ReactNode;
}) {
  const Icon = pressed ? Check : Plus;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onPress}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-semibold transition-colors max-sm:min-h-11",
        pressed
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-primary bg-primary text-secondary hover:bg-primary_hover",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </button>
  );
}

/** "Was $32.99 · Undo", under a field that reading a link changed. */
function WasLine({ children, onUndo }: { children: ReactNode; onUndo: () => void }) {
  return (
    <p className="flex min-w-0 items-center gap-1 text-xs text-tertiary">
      <span className="min-w-0 truncate">{children}</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 px-1 font-semibold text-brand-600 hover:underline max-sm:min-h-11 max-sm:px-2"
      >
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
}: EditItemDialogProps) {
  const isBaby = registryType === "baby";
  const copy = copyFor({ registryType, eventType });
  const uid = useId();
  // True from Save until the dialog closes or shows an error. The form's
  // action runs in a transition, where a plain state change wouldn't show
  // until the action ends, so "Saving..." would never appear.
  const [loading, setLoading] = useOptimistic(false);
  const [deleting, setDeleting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [scrapeIsError, setScrapeIsError] = useState(false);
  const [error, setError] = useState("");
  const [mostWanted, setMostWanted] = useState(item.is_essential);
  const [openToUsed, setOpenToUsed] = useState(item.is_open_to_used);
  const [condition, setCondition] = useState(item.minimum_condition || "like-new");
  const [parentPurchased, setParentPurchased] = useState(item.is_parent_purchased);
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(item.price != null ? item.price.toFixed(2) : "");
  const [imageUrl, setImageUrl] = useState(item.image_url || "");
  const [externalUrl, setExternalUrl] = useState(item.external_url || "");
  const [taxInfo, setTaxInfo] = useState<{ original: string; rate: number } | null>(null);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [categoryId, setCategoryId] = useState<string | undefined>(
    item.category_id ?? undefined,
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  // The owner asked to change the link. An item without one starts that way.
  const [linkOpen, setLinkOpen] = useState(!item.external_url);
  // The link before Change link, so Keep the current link can put it back.
  const [linkBefore, setLinkBefore] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<Replaced>(NOTHING_REPLACED);
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [brokenCandidates, setBrokenCandidates] = useState<Set<string>>(new Set());
  const [showImageLink, setShowImageLink] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const urlRef = useRef<HTMLInputElement>(null);
  const openUrl = openableLink(externalUrl);
  const savedLink = item.external_url ? withScheme(item.external_url.trim()) : null;
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
  const symbol = currencySymbols[currency] || "$";
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
        if (stillCurrent()) setScrapeStatus("Reading the page in a background tab with the Regibee extension…");
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
      setScrapeStatus("There's no link on your clipboard. Copy the product's link, then tap Paste.");
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
    setGuestInfoOpen(false);
    setCurrency("USD");
    setError("");
    setTitle(item.title);
    setPrice(item.price != null ? item.price.toFixed(2) : "");
    setImageUrl(item.image_url || "");
    setExternalUrl(item.external_url || "");
    setTaxInfo(null);
    setCategoryId(item.category_id ?? undefined);
    setAddingCategory(false);
    setNewCategoryName("");
    setCategoryError("");
    setLinkOpen(!item.external_url);
    setLinkBefore(null);
    setReplaced(NOTHING_REPLACED);
    setImageCandidates([]);
    setBrokenCandidates(new Set());
    picturesFrom.current = null;
    setShowImageLink(false);
    setUploadError(null);
  };

  const onOtherLists = otherLists.length > 0;
  const handleDelete = async () => {
    const question = onOtherLists
      ? `Remove "${item.title}" from this list? It stays on ${listNames(otherLists)}.`
      : `Delete "${item.title}"? This cannot be undone.`;
    if (!confirm(question)) return;
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteRegistryItem(item.id, registryId);
      if (result?.error) {
        setError(result.error);
        setDeleting(false);
        return;
      }
      closeWithNewPage(() => setDeleting(false));
    });
  };
  const removeLabel = deleting ? "Removing..." : onOtherLists ? "Remove from list" : "Remove item";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {/* grid-cols-1 keeps the one-line link from widening the sheet on phones. */}
      <DialogContent size="wide" className="max-h-[90vh] grid-cols-1 overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          {onOtherLists && (
            <DialogDescription>
              It&apos;s also on {listNames(otherLists)}, so changes show there too. Its category is only for this list.
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
            <div className="space-y-2.5 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Label className="!text-sm !font-semibold !text-primary">Paste a link from any store</Label>
                {linkBefore !== null && (
                  <button
                    type="button"
                    // Kept from taking focus, so leaving the field doesn't
                    // start reading the link this button puts back.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={keepCurrentLink}
                    className="text-sm font-semibold text-brand-600 hover:underline max-sm:min-h-11"
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
                className={cn("text-xs", scrapeIsError ? "text-warning-primary" : scrapeStatus ? "text-brand-600" : "text-tertiary")}
              >
                {scrapeStatus || (scraping ? "Reading the page…" : "We'll fill in the name, price and photo from the page.")}
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
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-800">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Registry link
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-tertiary max-sm:hidden" title={externalUrl}>
                    {shortLink(externalUrl)}
                  </span>
                </div>
                <div className="ml-auto flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={readAgain}
                    title="Read the page again"
                    aria-label="Read the page again"
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
                    aria-label="Open link in a new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={changeLink}
                    className="min-h-9 shrink-0 rounded-md px-2.5 text-sm font-semibold text-brand-600 hover:bg-primary_hover max-sm:min-h-11"
                  >
                    Change link
                  </button>
                </div>
              </div>
              {scrapeStatus && (
                <p role="status" className="text-xs text-brand-600">
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
              <ItemImage
                size="fill"
                imageUrl={imageUrl || null}
                title={title || item.title}
                categoryName={categoryName}
                className="h-40 md:h-64"
              />
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
              {photoChoices.length > 1 && (
                <div role="group" aria-label="Photos from this page" className="flex gap-2 overflow-x-auto pb-1">
                  {photoChoices.map((candidate) => {
                    const selected = candidate === imageUrl;
                    return (
                      <button
                        key={candidate}
                        type="button"
                        onClick={() => setImageUrl(candidate)}
                        aria-label="Use this photo"
                        aria-pressed={selected}
                        className={cn(
                          "relative size-14 shrink-0 overflow-hidden rounded-md border-2 bg-tertiary transition",
                          selected ? "border-brand-600 ring-2 ring-brand-600/30" : "border-transparent hover:border-secondary",
                        )}
                      >
                        <img
                          src={candidate}
                          alt=""
                          className="size-full object-cover"
                          onError={() =>
                            setBrokenCandidates((prev) => {
                              const next = new Set(prev);
                              next.add(candidate);
                              return next;
                            })
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <PhotoUploadButton
                  upload={(file) => uploadRegistryPhoto(registryId, file)}
                  onUploaded={(url) => {
                    setImageUrl(url);
                    setShowImageLink(false);
                  }}
                  onError={setUploadError}
                />
                <button
                  type="button"
                  aria-expanded={showImageLink}
                  onClick={() => setShowImageLink((shown) => !shown)}
                  className="text-sm font-semibold text-brand-600 hover:underline max-sm:min-h-11"
                >
                  Use an image link
                </button>
              </div>
              {uploadError && <p className="text-xs text-error-primary">{uploadError}</p>}
              {showImageLink && (
                <Input
                  label="Image link"
                  placeholder="https://www.example.com/photo.jpg"
                  value={imageUrl}
                  onChange={(url) => {
                    setImageUrl(url);
                    setUploadError(null);
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
                    prefix={symbol}
                    trailingAddon={<CurrencySelect value={currency} onChange={setCurrency} />}
                  >
                    <InputBase
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
                      Was {symbol}
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
                <div className="col-span-2 min-w-0 space-y-1.5 md:col-span-1">
                  <Select
                    name="categoryId"
                    label="Category"
                    selectedKey={categoryId ?? null}
                    onSelectionChange={(key) => setCategoryId(key?.toString() || undefined)}
                    placeholder={categories.length === 0 ? "No categories yet" : "No category"}
                    items={categories.map((cat) => ({ id: cat.id, label: cat.name }))}
                    isDisabled={categories.length === 0}
                  >
                    {(catItem) => <Select.Item id={catItem.id} label={catItem.label} />}
                  </Select>
                  {!addingCategory && (
                    <button
                      type="button"
                      onClick={() => setAddingCategory(true)}
                      className="text-xs font-medium text-brand-600 hover:underline max-sm:min-h-11 max-sm:pr-3"
                    >
                      + New category
                    </button>
                  )}
                </div>
              </div>

              {addingCategory && (
                <div className="space-y-1.5">
                  <Label>New category</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      name="newCategoryName"
                      placeholder="e.g., Kitchen"
                      value={newCategoryName}
                      onChange={setNewCategoryName}
                      autoComplete="off"
                      className="flex-1 max-sm:basis-full"
                    />
                    <Button
                      type="button"
                      disabled={!newCategoryName.trim() || creatingCategory}
                      onClick={async () => {
                        setCreatingCategory(true);
                        setCategoryError("");
                        const result = await createCategory(registryId, newCategoryName.trim());
                        if (result?.error) {
                          setCategoryError(result.error);
                        } else if (result?.category) {
                          const next = categories.some((c) => c.id === result.category.id)
                            ? categories
                            : [...categories, result.category];
                          setCategories(next);
                          setCategoryId(result.category.id);
                          setAddingCategory(false);
                          setNewCategoryName("");
                        }
                        setCreatingCategory(false);
                      }}
                    >
                      {creatingCategory ? "Adding..." : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAddingCategory(false);
                        setNewCategoryName("");
                        setCategoryError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {categoryError && <p className="text-xs text-error-primary">{categoryError}</p>}
                </div>
              )}

              <TextArea
                label="Note for guests (optional)"
                name="notes"
                placeholder="Size, color, or anything else that helps"
                defaultValue={item.notes || ""}
                rows={3}
              />

              {/* Owners change these rarely, so they share one row. The info
                  button explains all three, since a tooltip doesn't work on
                  a phone. */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <span id={`${uid}-guests`} className="text-sm font-medium text-secondary">
                    For guests
                  </span>
                  <button
                    type="button"
                    aria-label="What these mean"
                    aria-expanded={guestInfoOpen}
                    aria-controls={`${uid}-guests-info`}
                    onClick={() => setGuestInfoOpen((shown) => !shown)}
                    className="inline-flex size-8 items-center justify-center rounded-full text-fg-quaternary hover:text-fg-secondary max-sm:size-11"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div role="group" aria-labelledby={`${uid}-guests`} className="flex flex-wrap gap-1.5">
                  <TogglePill
                    pressed={mostWanted}
                    onPress={() => setMostWanted((on) => !on)}
                    title="Guests see it tagged Most wanted."
                  >
                    Most wanted
                  </TogglePill>
                  <TogglePill
                    pressed={openToUsed}
                    onPress={() => setOpenToUsed((on) => !on)}
                    title="Guests may give a hand-me-down."
                  >
                    Open to hand-me-downs
                  </TogglePill>
                  <TogglePill
                    pressed={parentPurchased}
                    onPress={() => setParentPurchased((on) => !on)}
                    title="Guests can pay you back for it instead of buying one."
                  >
                    {copy.selfPurchasedLabel}
                  </TogglePill>
                </div>
                {guestInfoOpen && (
                  <div id={`${uid}-guests-info`} className="space-y-1 rounded-lg bg-secondary px-3 py-2.5 text-sm text-secondary">
                    <p>
                      <span className="font-semibold text-primary">Most wanted</span> tags it so guests spot it first.
                    </p>
                    <p>
                      <span className="font-semibold text-primary">Open to hand-me-downs</span> lets guests give one
                      that&apos;s been used, in at least the condition you pick.
                    </p>
                    <p>
                      <span className="font-semibold text-primary">{copy.selfPurchasedLabel}</span> means you bought
                      it already. Guests can pay you back for it instead of buying one.
                    </p>
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

          {/* Three buttons don't fit a phone's sticky bar, so on phones
              Remove item sits above it, at the end of the form. */}
          <Button
            type="button"
            variant="destructive-outline"
            onClick={handleDelete}
            disabled={deleting}
            className="w-full sm:hidden"
          >
            {removeLabel}
          </Button>
          <DialogFooter sticky className="sm:items-center">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-error-primary hover:bg-error-primary/5 disabled:opacity-50 max-sm:hidden"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {removeLabel}
            </button>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
