"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Loader2, DollarSign } from "lucide-react";
import { Clipboard, Link01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Input, InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { Label } from "@/components/base/input/label";
import { CategoryField } from "@/components/category-field";
import { TextArea } from "@/components/base/textarea/textarea";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Select } from "@/components/base/select/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addRegistryItem, createCategory } from "@/lib/actions/registry";
import { fetchProductDetails } from "@/lib/fetch-product";
import { gtinForLink, type ReadGtin } from "@/lib/gtin";
import { estimateTax } from "@/lib/actions/tax";
import { suggestCategory } from "@/lib/item-categories";
import type { PersonalEventType, RegistryType } from "@/lib/types";
import { copyFor } from "@/lib/registry-copy";
import { detectStore, type RetailerRegistry, type StoreId } from "@/lib/retailers";
import { findSharedLink, nameFromProductUrl } from "@/lib/shared-link";
import { StoreLinkNotice } from "@/components/store-link-notice";
import { ItemImageField } from "@/components/item-image-field";
import { uploadRegistryPhoto } from "@/lib/upload-registry-photo";

interface Category {
  id: string;
  name: string;
}

/** A list the Saved tab's "Save an item" can save to. */
export interface SaveToList {
  id: string;
  title: string;
  categories: Category[];
  registryType: RegistryType;
  eventType: PersonalEventType | null;
}

interface AddItemDialogProps {
  registryId: string;
  categories: Category[];
  zipCode?: string;
  registryType?: RegistryType;
  eventType?: PersonalEventType | null;
  defaultValues?: {
    title?: string;
    price?: string;
    categoryId?: string;
    quantityNeeded?: string;
    isEssential?: boolean;
    notes?: string;
    /** The baby checklist entry the item counts for, when added from the checklist (src/lib/checklist-matching.ts). */
    checklistEntry?: string;
  };
  trigger?: React.ReactNode;
  /**
   * Opens and closes the dialog from outside, with no button of its own. The
   * checklist opens it this way, filled in from an entry.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The owner's linked store registries. Leave unset to hide store notices
   *  (personal registries don't use them). */
  linkedRegistries?: RetailerRegistry[];
  /** Stores that other items on this registry have registry links from. */
  storesWithRegistryLinks?: StoreId[];
  /**
   * Open on load with this link, and its product name when known, filled in,
   * then read the link. For links shared to the site from a phone (/share).
   */
  openWithLink?: { url: string; title?: string };
  /**
   * Lets the owner pick which of their lists to save to, starting with
   * `registryId`. The Saved tab passes their lists. Each list brings its own
   * categories and kind, in place of the props above.
   */
  saveTo?: SaveToList[];
  /** Called after the item is saved. */
  onAdded?: (registryId: string) => void;
}

/**
 * The store's name, or the site's address at a store Regibee doesn't know, as
 * the app's storeLabel (mobile/src/lib/product.ts) words it.
 */
export function storeNameForLink(url: string): string {
  const store = detectStore(url);
  if (store) return store.name;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "this link";
  }
}

/**
 * What the add and edit item dialogs say after reading a link. The app's item
 * editor (mobile/src/components/item-editor.tsx) says the same.
 */
export const readLinkMessages = {
  filled: (store: string) => `Filled in from ${store}. Check it over.`,
  nothingNew: (store: string) => `Nothing new to fill in from ${store}.`,
  failed: (store: string, hasName: boolean) =>
    hasName
      ? `We couldn't read the details from ${store}. Fill in the rest yourself.`
      : `We couldn't read the details from ${store}. Add the name and the rest yourself.`,
};

/** The category field's key for a guessed category the list doesn't have yet. */
const NEW_CATEGORY_KEY = "__new_category__";

export function AddItemDialog({
  registryId: defaultRegistryId,
  categories: defaultCategories,
  zipCode,
  registryType: defaultRegistryType = "baby",
  eventType: defaultEventType = null,
  defaultValues,
  trigger,
  linkedRegistries,
  storesWithRegistryLinks,
  openWithLink,
  saveTo,
  onAdded,
  open: controlledOpen,
  onOpenChange,
}: AddItemDialogProps) {
  // With saveTo, the owner picks the list. Everything below works on the
  // chosen one.
  const [chosenListId, setChosenListId] = useState(defaultRegistryId);
  const chosenList = saveTo?.find((list) => list.id === chosenListId) ?? null;
  const registryId = chosenList?.id ?? defaultRegistryId;
  const initialCategories = chosenList?.categories ?? defaultCategories;
  const registryType = chosenList?.registryType ?? defaultRegistryType;
  const eventType = chosenList ? chosenList.eventType : defaultEventType;
  const copy = copyFor({ registryType, eventType });
  const isBaby = registryType === "baby";
  const [uncontrolledOpen, setOpen] = useState(Boolean(openWithLink));
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string>("");
  const [scrapeIsError, setScrapeIsError] = useState(false);
  const [error, setError] = useState("");
  const [parentPurchased, setParentPurchased] = useState(false);
  const [openToUsed, setOpenToUsed] = useState(false);
  const [taxInfo, setTaxInfo] = useState<{ original: string; rate: number } | null>(null);
  const [title, setTitle] = useState(openWithLink?.title || defaultValues?.title || "");
  const [price, setPrice] = useState(defaultValues?.price ? parseFloat(defaultValues.price).toFixed(2) : "");
  const [imageUrl, setImageUrl] = useState("");
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [brokenCandidates, setBrokenCandidates] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState<string | undefined>(defaultValues?.categoryId);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  // A guessed category the list doesn't have yet, such as "Food & Drink". It
  // shows in the field as chosen and is added to the list when the item is
  // saved, so closing the dialog leaves no empty category behind.
  const [newCategoryName, setNewCategoryName] = useState<string | null>(null);
  const pendingChosen = newCategoryName !== null && categoryId === NEW_CATEGORY_KEY;
  const fieldCategories = pendingChosen ? [...categories, { id: NEW_CATEGORY_KEY, name: newCategoryName }] : categories;

  const [externalUrl, setExternalUrl] = useState(openWithLink?.url || "");

  const urlRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const readSharedLink = useRef(false);
  // Reading a link can take many seconds, and the owner may close the dialog
  // meanwhile. Each read takes the next number. Closing the dialog moves the
  // number on, so a read that finishes after that leaves the fresh form alone.
  const readNumber = useRef(0);
  const isOpen = useRef(open);
  // Opened from outside, the dialog never runs changeOpen(true).
  useEffect(() => {
    isOpen.current = open;
  }, [open]);
  // The link last read, so leaving the field doesn't read the same link again.
  const lastReadUrl = useRef<string | null>(null);
  // The link the picture choices came from.
  const picturesFrom = useRef<string | null>(null);
  // The product's barcode number and the link it was read from. It's saved
  // only if the item keeps that link (src/lib/gtin.ts).
  const readGtin = useRef<ReadGtin | null>(null);
  // The item name a category was last guessed from.
  const guessedFrom = useRef<string | null>(null);

  // Reading the clipboard needs a secure page and a browser that allows it.
  // Only the open dialog asks, so this never runs during server rendering.
  const canPaste = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";

  // A link shared from a phone: read it once the dialog is open, and take the
  // share's query off the address so a reload doesn't open the dialog again.
  useEffect(() => {
    if (!openWithLink || readSharedLink.current) return;
    readSharedLink.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    handleScrape(openWithLink.url, { knownTitle: openWithLink.title });
    // Runs once, for the link the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeUrl = (url: string) => {
    if (!url) return url;
    if (!/^https?:\/\//i.test(url)) return `http://${url}`;
    return url;
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    setTaxInfo(null);
  };

  const handlePriceBlur = async () => {
    if (!price) return;
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed <= 0) return;
    if (!parentPurchased || !zipCode || taxInfo) {
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
   * Chooses the category that fits the item best, when none is chosen yet: one
   * of the list's, or a new one to add on saving. True when it chose one. The
   * phone app and the extension guess the same way (src/lib/item-categories.ts).
   */
  const inferCategory = (productTitle: string, storeCategory?: string[]): boolean => {
    if (categoryId) return false;
    const guess = suggestCategory({ title: productTitle, storeCategory }, categories);
    if (!guess) return false;
    if (guess.id) {
      setCategoryId(guess.id);
    } else {
      setNewCategoryName(guess.name);
      setCategoryId(NEW_CATEGORY_KEY);
    }
    return true;
  };

  /**
   * Reads the link and fills in what the owner hasn't. `knownTitle` is a name
   * set in the same tap, before state has caught up. `fromTap` is true when the
   * owner tapped Paste or Fetch rather than leaving the field, so it's fine to
   * move focus to what's left to fill in. Leaving the field reads the link only
   * when it changed since the last read.
   */
  const handleScrape = async (rawUrl: string, options: { knownTitle?: string; fromTap?: boolean } = {}) => {
    // Leaving the field calls this too, so it can run as the dialog closes.
    if (!rawUrl || scraping || !isOpen.current) return;
    const url = normalizeUrl(rawUrl.trim());
    const currentTitle = options.knownTitle || title;

    try {
      new URL(url);
    } catch {
      return;
    }
    if (!options.fromTap && url === lastReadUrl.current) return;
    lastReadUrl.current = url;

    // Pictures from another link show another product, so clear them, and
    // the chosen image if it's one of them. A photo the owner uploaded stays.
    let currentImage = imageUrl;
    if (picturesFrom.current && picturesFrom.current !== url) {
      if (imageCandidates.includes(imageUrl)) {
        setImageUrl("");
        currentImage = "";
      }
      setImageCandidates([]);
      setBrokenCandidates(new Set());
      picturesFrom.current = null;
    }

    const run = ++readNumber.current;
    const stillCurrent = () => run === readNumber.current;
    setScraping(true);
    setScrapeStatus("");
    setScrapeIsError(false);

    const result = await fetchProductDetails(url, {
      onReadingWithExtension: () => {
        if (stillCurrent()) setScrapeStatus("Reading the page in a background tab…");
      },
    });
    if (!stillCurrent()) return;

    if (result.error) {
      // Some stores, Amazon above all, block the server from reading their
      // pages. That's no dead end: keep the link and whatever the owner has,
      // take a name from the link when it has one, and let them finish.
      const store = storeNameForLink(url);
      const guessedTitle = currentTitle ? undefined : nameFromProductUrl(url);
      if (guessedTitle) setTitle(guessedTitle);
      if (currentTitle || guessedTitle) inferCategory(currentTitle || guessedTitle || "");
      setScrapeStatus(
        guessedTitle
          ? `We couldn't read the details from ${store}. Check the name and fill in the rest.`
          : readLinkMessages.failed(store, Boolean(currentTitle)),
      );
      setScrapeIsError(true);
      if (options.fromTap) (currentTitle || guessedTitle ? priceRef : titleRef).current?.focus();
    } else {
      readGtin.current = { url, gtin: result.gtin ?? null };
      // The tax added to the price shows under the price field.
      let filledAny = false;
      if (result.title && !currentTitle) {
        setTitle(result.title);
        filledAny = true;
      }
      if (result.price && !price) {
        let finalPrice = parseFloat(result.price).toFixed(2);
        if (parentPurchased && zipCode) {
          const taxResult = await estimateTax(zipCode, parseFloat(result.price));
          if (!stillCurrent()) return;
          if (taxResult) {
            setTaxInfo({ original: finalPrice, rate: taxResult.taxRate });
            finalPrice = taxResult.priceWithTax;
          }
        }
        setPrice(finalPrice);
        filledAny = true;
      }
      const candidates = result.imageUrls ?? (result.imageUrl ? [result.imageUrl] : []);
      if (candidates.length > 0) {
        setImageCandidates(candidates);
        setBrokenCandidates(new Set());
        picturesFrom.current = url;
        if (!currentImage) {
          setImageUrl(candidates[0]);
          filledAny = true;
        }
      }
      const titleForCategory = result.title || currentTitle;
      if ((titleForCategory || result.storeCategory) && inferCategory(titleForCategory ?? "", result.storeCategory)) {
        filledAny = true;
      }
      const store = storeNameForLink(url);
      setScrapeStatus(filledAny ? readLinkMessages.filled(store) : readLinkMessages.nothingNew(store));
    }

    setScraping(false);
  };

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
    const knownTitle = title || shared.title;
    if (!title && shared.title) setTitle(shared.title);
    handleScrape(shared.url, { knownTitle, fromTap: true });
  };

  // Back to a clean form, so reopening the dialog starts fresh. A read still
  // under way is dropped when it finishes.
  const resetForm = () => {
    readNumber.current++;
    lastReadUrl.current = null;
    picturesFrom.current = null;
    readGtin.current = null;
    guessedFrom.current = null;
    setScraping(false);
    setScrapeStatus("");
    setScrapeIsError(false);
    setParentPurchased(false);
    setOpenToUsed(false);
    setTaxInfo(null);
    setTitle(defaultValues?.title || "");
    setPrice(defaultValues?.price ? parseFloat(defaultValues.price).toFixed(2) : "");
    setImageUrl("");
    setImageCandidates([]);
    setBrokenCandidates(new Set());
    setCategoryId(defaultValues?.categoryId);
    setNewCategoryName(null);
    setExternalUrl("");
    setError("");
    if (saveTo) {
      setChosenListId(defaultRegistryId);
      setCategories(saveTo.find((list) => list.id === defaultRegistryId)?.categories ?? defaultCategories);
    }
  };

  const changeOpen = (next: boolean) => {
    isOpen.current = next;
    setOpen(next);
    onOpenChange?.(next);
    if (!next) resetForm();
  };

  /** Saving to another list: its categories replace the last list's. */
  const chooseList = (id: string) => {
    const list = saveTo?.find((l) => l.id === id);
    if (!list) return;
    setChosenListId(id);
    setCategories(list.categories);
    setCategoryId(undefined);
    setNewCategoryName(null);
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
    // A guessed category the list doesn't have yet is added now.
    if (formData.get("categoryId") === NEW_CATEGORY_KEY) {
      const made = newCategoryName ? await createCategory(registryId, newCategoryName) : null;
      if (made?.category) {
        const category = made.category;
        setCategories((before) => (before.some((c) => c.id === category.id) ? before : [...before, category]));
        formData.set("categoryId", category.id);
      } else {
        // The item matters more than its category: save it without one.
        formData.set("categoryId", "");
      }
    }
    const result = await addRegistryItem(registryId, formData);
    if (result?.error) {
      setError(result.error);
    } else {
      const savedTo = registryId;
      changeOpen(false);
      onAdded?.(savedTo);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4 shrink-0" />
                Add item
              </span>
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{saveTo ? "Save an item" : "Add an item"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="min-w-0 space-y-5">
          {defaultValues?.checklistEntry && (
            <input type="hidden" name="checklistEntry" value={defaultValues.checklistEntry} />
          )}
          {saveTo && saveTo.length > 0 && (
            <Select
              label="Save to"
              selectedKey={registryId}
              onSelectionChange={(key) => key && chooseList(key.toString())}
              items={saveTo.map((list) => ({ id: list.id, label: list.title }))}
            >
              {(item) => <Select.Item id={item.id} label={item.label} />}
            </Select>
          )}
          {/* Step 1 — URL hero */}
          <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-primary p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-solid text-xs font-semibold text-primary_on-brand">
                1
              </span>
              <Label className="!text-sm !font-semibold !text-primary">
                Paste a product link
              </Label>
            </div>
            {/* On phones the field takes the full width, with the buttons
                below it sharing a row. */}
            <div className="flex items-stretch gap-2 pl-8 max-sm:flex-col max-sm:pl-0">
              <Input
                ref={urlRef}
                name="externalUrl"
                aria-label="Product link"
                placeholder="https://www.target.com/..."
                value={externalUrl}
                onChange={setExternalUrl}
                onBlur={(e) => handleScrape((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  // Enter reads the link instead of submitting the half-filled form.
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
                {/* Pasting into a field is fiddly on a phone, so offer a button
                    on touch screens and narrow windows. */}
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
                    if (externalUrl) handleScrape(externalUrl, { fromTap: true });
                  }}
                  className="h-10"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {scraping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link01 className="h-4 w-4" />
                    )}
                    {scraping ? "Fetching…" : "Fetch"}
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
                className="ml-8"
              />
            )}
            {scrapeStatus && (
              <p role="status" className={`text-xs pl-8 max-sm:pl-0 ${scrapeIsError ? "text-warning-primary" : "text-brand-tertiary"}`}>{scrapeStatus}</p>
            )}
          </div>

          {/* Step 2 — details */}
          <div className="flex flex-wrap items-center gap-x-2 pt-1">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-tertiary">
              2
            </span>
            <span className="text-sm font-semibold text-primary">
              Confirm the details
            </span>
            <span className="ml-auto text-xs text-tertiary max-sm:ml-0">
              or fill in manually
            </span>
          </div>

          <Input
            ref={titleRef}
            label="Item name"
            name="title"
            placeholder={isBaby ? "e.g., Convertible Crib" : "e.g., Wireless Headphones"}
            value={title}
            onChange={setTitle}
            onBlur={() => {
              // Only for a name that changed, so a category the owner took
              // away doesn't come back each time they leave the field.
              if (!title.trim() || guessedFrom.current === title) return;
              guessedFrom.current = title;
              inferCategory(title);
            }}
            autoComplete="off"
            enterKeyHint="next"
            isRequired
          />

          <Checkbox
            name="isEssential"
            value="true"
            defaultSelected={defaultValues?.isEssential}
            label="Most wanted"
          />

          <CategoryField
            name="categoryId"
            categories={fieldCategories}
            value={categoryId}
            onChange={setCategoryId}
            hint={pendingChosen ? "New category" : undefined}
            onCreate={async (name) => {
              const result = await createCategory(registryId, name);
              if (result?.error) return result.error;
              if (result?.category) {
                const made = result.category;
                setCategories((before) => (before.some((c) => c.id === made.id) ? before : [...before, made]));
                setCategoryId(made.id);
              }
              return null;
            }}
          />

          <div className="space-y-1.5">
            <ItemImageField
              value={imageUrl}
              onChange={setImageUrl}
              upload={(file) => uploadRegistryPhoto(registryId, file)}
            />
            {imageCandidates.filter((c) => !brokenCandidates.has(c)).length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs text-tertiary">
                  Choose a photo
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {imageCandidates
                    .filter((candidate) => !brokenCandidates.has(candidate))
                    .map((candidate) => {
                      const selected = candidate === imageUrl;
                      return (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => {
                            setImageUrl(candidate);
                          }}
                          aria-label="Use this image"
                          aria-pressed={selected}
                          className={`relative size-14 shrink-0 overflow-hidden rounded-md border-2 bg-tertiary transition ${
                            selected
                              ? "border-brand-solid ring-2 ring-brand-solid/30"
                              : "border-transparent hover:border-secondary"
                          }`}
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
              </div>
            )}
          </div>

          {/* On phones the price gets most of the row. The quantity needs
              little room. */}
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4 sm:grid-cols-2">
            <InputGroup
              label="Price (optional)"
              name="price"
              value={price}
              onChange={handlePriceChange}
            >
              <InputBase
                ref={priceRef}
                icon={DollarSign}
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                placeholder="0.00"
                enterKeyHint="next"
                onBlur={handlePriceBlur}
              />
            </InputGroup>
            <Input
              label="Quantity"
              name="quantityNeeded"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={defaultValues?.quantityNeeded || "1"}
            />
          </div>
          {taxInfo && (
            <p className="text-xs text-tertiary">
              ${taxInfo.original} + ~{(taxInfo.rate * 100).toFixed(1)}% tax
            </p>
          )}

          <Checkbox
            name="isParentPurchased"
            value="true"
            isSelected={parentPurchased}
            onChange={setParentPurchased}
            label={copy.selfPurchaseButton}
          />

          <Checkbox
            name="isOpenToUsed"
            value="true"
            isSelected={openToUsed}
            onChange={setOpenToUsed}
            label="Open to hand-me-downs"
          />
          {openToUsed && (
            <div className="pl-6">
              <Select
                name="minimumCondition"
                label="Minimum condition"
                defaultSelectedKey="like-new"
                items={[
                  { id: "like-new", label: "Like new" },
                  { id: "very-good", label: "Very good" },
                  { id: "good", label: "Good" },
                  { id: "acceptable", label: "Acceptable" },
                ]}
              >
                {(item) => <Select.Item id={item.id} label={item.label} />}
              </Select>
            </div>
          )}

          <TextArea
            label="Note for guests (optional)"
            name="notes"
            placeholder="Size, color, or anything else that helps"
            defaultValue={defaultValues?.notes}
            rows={3}
          />

          {error && <p className="text-sm text-error-primary">{error}</p>}

          <DialogFooter sticky>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (saveTo ? "Saving..." : "Adding...") : saveTo ? "Save item" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
