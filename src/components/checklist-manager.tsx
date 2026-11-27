"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bath,
  BookOpen,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Gift,
  Heart,
  HeartPulse,
  Link2,
  ListChecks,
  Moon,
  Package,
  Plus,
  Shirt,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { AddItemDialog } from "@/components/add-item-dialog";
import { AddCashFundDialog } from "@/components/add-cash-fund-dialog";
import { ChecklistEntryDialog } from "@/components/checklist-entry-picker";
import {
  DEFAULT_CHECKLIST,
  checklistPrice,
  checklistQuantity,
  type ChecklistCategory,
  type ChecklistItem,
  type ChecklistSource,
} from "@/lib/checklist-data";
import { CHECKLIST_NONE, entryTakes, specificQuestion } from "@/lib/checklist-matching";
import type { ChecklistPageData, ChecklistPageThing } from "@/lib/checklist-page-types";
import { addRegistryItem, setChecklistEntry, toggleChecklistDismissed } from "@/lib/actions/registry";

// A baby registry's checklist: the things most new parents need, by category,
// and what on the list counts for each one (src/lib/checklist-matching.ts).
// The page loads its data on the server (src/lib/checklist-page.ts), so
// nothing can be added before the list's categories and items are known.
//
// The phone app's checklist screen (mobile/src/app/registry/[id]/checklist.tsx)
// does the same in the same words. Change both together.

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  moon: Moon,
  utensils: Utensils,
  package: Package,
  car: Car,
  bath: Bath,
  shirt: Shirt,
  "heart-pulse": HeartPulse,
  "book-open": BookOpen,
  heart: Heart,
  gift: Gift,
};

type FilterMode = "essential" | "all" | "not-added";

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: "essential", label: "Essentials" },
  { id: "all", label: "All" },
  { id: "not-added", label: "Not added" },
];

/** Essentials first, then the rest, each in the checklist's order. */
function essentialsFirst(items: ChecklistItem[]): ChecklistItem[] {
  return [...items.filter((i) => i.isEssential), ...items.filter((i) => !i.isEssential)];
}

export interface ChecklistManagerProps {
  data: ChecklistPageData;
  /** Stand-ins for the server actions, for stories. */
  actions?: {
    addItem?: typeof addRegistryItem;
    setEntry?: typeof setChecklistEntry;
    toggleDismissed?: typeof toggleChecklistDismissed;
  };
}

export function ChecklistManager({ data, actions }: ChecklistManagerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const registryId = data.registry.id;
  const addItem = actions?.addItem ?? addRegistryItem;
  const setEntry = actions?.setEntry ?? setChecklistEntry;
  const toggleDismissed = actions?.toggleDismissed ?? toggleChecklistDismissed;

  const [filter, setFilter] = useState<FilterMode>("essential");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // The entry whose "Have a specific one in mind?" question is open.
  const [asking, setAsking] = useState<{ entry: ChecklistItem; category: ChecklistCategory } | null>(null);
  // The entry the add item dialog is open for, to add a specific product.
  const [addingSpecific, setAddingSpecific] = useState<{ entry: ChecklistItem; category: ChecklistCategory } | null>(
    null,
  );
  const [fundEntry, setFundEntry] = useState<ChecklistItem | null>(null);
  // Something on the list being moved to another entry.
  const [moving, setMoving] = useState<ChecklistPageThing | null>(null);
  // An entry the owner is choosing something already on their list for.
  const [choosingFor, setChoosingFor] = useState<ChecklistItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const byEntry = useMemo(() => {
    const map = new Map<string, ChecklistPageThing[]>();
    for (const thing of data.things) {
      if (!thing.entry) continue;
      map.set(thing.entry, [...(map.get(thing.entry) ?? []), thing]);
    }
    return map;
  }, [data.things]);
  const uncounted = data.things.filter((thing) => !thing.entry);
  const dismissed = new Set(data.dismissed);
  const isDone = (entry: ChecklistItem) => Boolean(byEntry.get(entry.key)?.length) || dismissed.has(entry.key);
  const categoryIdFor = (category: ChecklistCategory) =>
    data.categories.find((c) => c.name.toLowerCase() === category.name.toLowerCase())?.id ?? "";

  const visible = (items: ChecklistItem[]) => {
    const shown = filter === "essential" ? items.filter((i) => i.isEssential) : filter === "not-added" ? items.filter((i) => !isDone(i)) : items;
    return essentialsFirst(shown);
  };

  const fail = (message: string | null | undefined) => toast.error(message || "That didn't work. Try again.");

  /** Adds the entry with no product, so guests choose one. */
  const addPlaceholder = async (entry: ChecklistItem, category: ChecklistCategory) => {
    setAsking(null);
    setBusy(entry.key);
    const formData = new FormData();
    formData.set("title", entry.name);
    formData.set("categoryId", categoryIdFor(category));
    formData.set("quantityNeeded", entry.suggestedQuantity.toString());
    if (entry.description) formData.set("notes", entry.description);
    formData.set("checklistEntry", entry.key);
    const result = await addItem(registryId, formData);
    setBusy(null);
    if (result && "error" in result && result.error) {
      fail(result.error);
      return;
    }
    toast.success(`Added ${entry.name}. Guests can choose which one to buy.`);
    refresh();
  };

  const startAdding = (entry: ChecklistItem, category: ChecklistCategory) => {
    if (entry.fund) setFundEntry(entry);
    else setAsking({ entry, category });
  };

  const markRegistered = async (entry: ChecklistItem, registered: boolean) => {
    setBusy(entry.key);
    const result = await toggleDismissed(registryId, entry.key, registered);
    setBusy(null);
    if (result?.error) fail(result.error);
    else refresh();
  };

  const countFor = async (thing: ChecklistPageThing, value: string) => {
    setBusy(thing.id);
    const result = await setEntry(
      registryId,
      thing.kind === "fund" ? { fundId: thing.id } : { itemId: thing.id },
      value,
    );
    setBusy(null);
    if (result.error) {
      fail(result.error);
      return false;
    }
    refresh();
    return true;
  };

  const allCollapsed = collapsed.size === DEFAULT_CHECKLIST.length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/registry/${registryId}`} aria-label="Back to registry">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Checklist</h1>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-medium">{data.essentialsDone}</span>
            <span className="text-tertiary"> of {data.essentialsTotal} essentials</span>
            <span className="text-tertiary">
              {" · "}
              {data.done} of {data.total} in all
            </span>
          </div>
          <Progress
            aria-label="Essentials added"
            value={data.essentialsTotal > 0 ? (data.essentialsDone / data.essentialsTotal) * 100 : 0}
            className="w-32"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg bg-secondary_alt ring-1 ring-inset ring-secondary">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap transition duration-100 ease-linear max-sm:min-h-11 ${
                  filter === id
                    ? "bg-primary_alt text-secondary shadow-xs ring-1 ring-primary ring-inset"
                    : "text-quaternary hover:text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(DEFAULT_CHECKLIST.map((c) => c.name)))}
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {DEFAULT_CHECKLIST.map((category) => {
          const isExpanded = !collapsed.has(category.name);
          const Icon = ICON_MAP[category.icon] || Package;
          const items = visible(category.items);
          const doneCount = category.items.filter(isDone).length;
          const essentials = category.items.filter((i) => i.isEssential);
          const essentialsDone = essentials.filter(isDone).length;
          if (items.length === 0 && filter !== "all") return null;

          return (
            <Card key={category.name}>
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() =>
                  setCollapsed((before) => {
                    const next = new Set(before);
                    if (next.has(category.name)) next.delete(category.name);
                    else next.add(category.name);
                    return next;
                  })
                }
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-active"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <Icon className="h-5 w-5 shrink-0 text-brand-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {doneCount}/{category.items.length}
                    </Badge>
                    {essentials.length > 0 && (
                      <span className="text-xs text-tertiary">
                        {essentialsDone}/{essentials.length} essentials
                      </span>
                    )}
                  </div>
                </div>
                <Progress
                  aria-label={`${category.name} items added`}
                  value={category.items.length > 0 ? (doneCount / category.items.length) * 100 : 0}
                  className="w-20 max-sm:w-12"
                />
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4">
                  <div className="divide-y">
                    {items.map((entry) => (
                      <EntryRow
                        key={entry.key}
                        entry={entry}
                        things={byEntry.get(entry.key) ?? []}
                        dismissed={dismissed.has(entry.key)}
                        busy={busy}
                        canChoose={data.things.some((t) => entryTakes(entry, t.kind) && t.entry !== entry.key)}
                        onAdd={() => startAdding(entry, category)}
                        onMarkRegistered={(registered) => markRegistered(entry, registered)}
                        onChooseFromList={() => setChoosingFor(entry)}
                        onMove={setMoving}
                        onUncount={(thing) => countFor(thing, CHECKLIST_NONE)}
                      />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {uncounted.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <h2 className="font-medium">Not on the checklist</h2>
              <ul className="mt-2 divide-y">
                {uncounted.map((thing) => (
                  <li key={thing.id} className="flex items-center gap-3 py-2">
                    <ThingLabel thing={thing} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === thing.id}
                      onClick={() => setMoving(thing)}
                    >
                      Count it
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* "Have a specific crib in mind?" Yes adds a product from its link. No
          adds the entry as it is, and guests pick one. */}
      <Dialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {asking && (
            <>
              <DialogHeader>
                <DialogTitle>{specificQuestion(asking.entry)}</DialogTitle>
                <DialogDescription>If not, guests can choose one.</DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => addPlaceholder(asking.entry, asking.category)}>
                  No, guests can choose
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setAddingSpecific(asking);
                    setAsking(null);
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="h-4 w-4 shrink-0" />
                    Yes, add its link
                  </span>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {addingSpecific && (
        <AddItemDialog
          key={addingSpecific.entry.key}
          open
          onOpenChange={(open) => !open && setAddingSpecific(null)}
          registryId={registryId}
          categories={data.categories}
          zipCode={data.zipCode}
          registryType="baby"
          defaultValues={{
            categoryId: categoryIdFor(addingSpecific.category) || undefined,
            quantityNeeded: addingSpecific.entry.suggestedQuantity.toString(),
            notes: addingSpecific.entry.description,
            checklistEntry: addingSpecific.entry.key,
          }}
          onAdded={() => {
            setAddingSpecific(null);
            refresh();
          }}
        />
      )}

      <AddCashFundDialog
        key={fundEntry?.key ?? "none"}
        registryId={registryId}
        paymentMethods={data.paymentMethods}
        defaults={
          fundEntry ? { title: fundEntry.name, description: fundEntry.description, checklistEntry: fundEntry.key } : undefined
        }
        open={fundEntry !== null}
        onOpenChange={(open) => {
          if (!open) setFundEntry(null);
        }}
        onCreated={refresh}
      />

      {moving && (
        <ChecklistEntryDialog
          open
          onOpenChange={(open) => !open && setMoving(null)}
          title={moving.title}
          kind={moving.kind}
          current={moving.entry}
          onChoose={async (value) => {
            if (await countFor(moving, value)) setMoving(null);
          }}
        />
      )}

      {choosingFor && (
        <ChooseFromListDialog
          entry={choosingFor}
          things={data.things.filter((t) => entryTakes(choosingFor, t.kind) && t.entry !== choosingFor.key)}
          busy={busy}
          onClose={() => setChoosingFor(null)}
          onChoose={async (thing) => {
            if (await countFor(thing, choosingFor.key)) setChoosingFor(null);
          }}
        />
      )}
    </div>
  );
}

/** Pages to read more about an entry, as small links that open in a new tab. */
function SourceLinks({ sources }: { sources: ChecklistSource[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.title}
          aria-label={`${source.name}: ${source.title} (opens in a new tab)`}
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset outline-focus-ring hover:text-primary focus-visible:outline-2 max-sm:min-h-8"
        >
          {source.name}
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

/** A small photo, or an icon, and the name of something on the list. */
function ThingLabel({ thing }: { thing: ChecklistPageThing }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {thing.image_url ? (
        <img src={thing.image_url} alt="" className="size-8 shrink-0 rounded bg-[#fdfdfd] object-cover" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-secondary text-fg-quaternary">
          {thing.kind === "fund" ? <DollarSign className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
        </span>
      )}
      <span className="min-w-0 text-sm break-words">{thing.title}</span>
    </span>
  );
}

interface EntryRowProps {
  entry: ChecklistItem;
  things: ChecklistPageThing[];
  dismissed: boolean;
  busy: string | null;
  /** Whether something on the list could count for this entry instead. */
  canChoose: boolean;
  onAdd: () => void;
  onMarkRegistered: (registered: boolean) => void;
  onChooseFromList: () => void;
  onMove: (thing: ChecklistPageThing) => void;
  onUncount: (thing: ChecklistPageThing) => void;
}

function EntryRow({
  entry,
  things,
  dismissed,
  busy,
  canChoose,
  onAdd,
  onMarkRegistered,
  onChooseFromList,
  onMove,
  onUncount,
}: EntryRowProps) {
  const added = things.length > 0;
  const done = added || dismissed;
  const working = busy === entry.key;
  const menu = [
    ...(canChoose ? [{ id: "choose", label: "Choose from your list", icon: ListChecks }] : []),
    { id: "mark", label: "Mark as registered", icon: Check },
  ];

  return (
    <div className="py-3">
      {/* On phones the buttons go under the entry, so the name keeps the width. */}
      <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className={`min-w-0 flex-1 ${done ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${done ? "line-through" : ""}`}>{entry.name}</span>
            {entry.isEssential && <Badge className="text-xs">Essential</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-tertiary">{checklistPrice(entry)}</span>
            {(entry.unit || entry.suggestedQuantity > 1) && (
              <span className="text-xs text-tertiary">Qty: {checklistQuantity(entry)}</span>
            )}
          </div>
          {entry.description && <p className="mt-0.5 text-xs text-tertiary">{entry.description}</p>}
          {entry.sources && entry.sources.length > 0 && <SourceLinks sources={entry.sources} />}
        </div>

        {added ? (
          <Badge variant="secondary" className="shrink-0 max-sm:self-start">
            <Check className="mr-1 h-3 w-3" />
            Added
          </Badge>
        ) : dismissed ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              <Check className="mr-1 h-3 w-3" />
              Marked as registered
            </Badge>
            <button
              type="button"
              onClick={() => onMarkRegistered(false)}
              disabled={working}
              className="text-xs text-tertiary transition-colors hover:text-secondary max-sm:min-h-11 max-sm:px-3"
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 max-sm:flex-wrap max-sm:justify-end">
            <Button size="sm" variant="secondary" className="shrink-0" disabled={working} onClick={onAdd}>
              <span className="inline-flex items-center gap-1">
                {working ? (
                  "Adding..."
                ) : (
                  <>
                    <Plus className="h-3 w-3 shrink-0" />
                    Add to registry
                  </>
                )}
              </span>
            </Button>
            {/* Few rows need these, so they're in a "…" menu instead of more
                buttons on every row. */}
            <RowActionsMenu
              label={`More actions for ${entry.name}`}
              actions={menu}
              disabled={working}
              onAction={(id) => (id === "choose" ? onChooseFromList() : onMarkRegistered(true))}
            />
          </div>
        )}
      </div>

      {added && (
        <ul className="mt-2 space-y-1" aria-label={`Counting for ${entry.name}`}>
          {things.map((thing) => (
            <li key={thing.id} className="flex items-center gap-2 rounded-lg bg-secondary px-2 py-1.5">
              <ThingLabel thing={thing} />
              <RowActionsMenu
                label={`Change what ${thing.title} counts for`}
                disabled={busy === thing.id}
                actions={[
                  { id: "move", label: "Count for something else", icon: ListChecks },
                  { id: "uncount", label: "Don't count it", icon: X },
                ]}
                onAction={(id) => (id === "move" ? onMove(thing) : onUncount(thing))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Picks something already on the list to count for an entry. */
function ChooseFromListDialog({
  entry,
  things,
  busy,
  onClose,
  onChoose,
}: {
  entry: ChecklistItem;
  things: ChecklistPageThing[];
  busy: string | null;
  onClose: () => void;
  onChoose: (thing: ChecklistPageThing) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Count for {entry.name}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {things.map((thing) => (
            <li key={thing.id}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => onChoose(thing)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 disabled:opacity-60 max-sm:min-h-11"
              >
                <ThingLabel thing={thing} />
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
