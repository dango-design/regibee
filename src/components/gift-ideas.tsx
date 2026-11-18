"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Lock, Plus } from "lucide-react";
import {
  ToggleButton as AriaToggleButton,
  ToggleButtonGroup as AriaToggleButtonGroup,
} from "react-aria-components";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { GiftIdeaDialog } from "@/components/gift-idea-dialog";
import { ItemImage } from "@/components/item-image";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { deleteGiftIdea, saveGiftIdea, setGiftIdeaBought } from "@/lib/actions/gift-ideas";
import type { fetchProductDetails } from "@/lib/fetch-product";
import { groupByRecipient, ideaCount, recentRecipients, type GiftIdea, type RecipientGroup } from "@/lib/gift-ideas";
import { formatPrice } from "@/lib/money";
import { cx } from "@/lib/utils/cx";

// The Saved tab's Gift ideas view: things you might give other people,
// grouped by who they're for. Only you can see them. Ticking "Bought it"
// shows straight away, and the card says "Saving…" until the server has it.
// Then the page refreshes from the server.

export interface GiftIdeasProps {
  ideas: GiftIdea[];
  /** A product shared from a phone (/share): open the save dialog on it. */
  openWithLink?: { url: string; title?: string };
  // Stories pass stand-ins. The page uses the real server actions.
  saveAction?: typeof saveGiftIdea;
  deleteAction?: typeof deleteGiftIdea;
  setBoughtAction?: typeof setGiftIdeaBought;
  readLink?: typeof fetchProductDetails;
}

/** Only web links open from the card. */
function webUrl(url: string | null) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function storeDomain(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function errorOf(result: unknown): string | null {
  if (result && typeof result === "object" && "error" in result) {
    const error = (result as { error?: unknown }).error;
    if (typeof error === "string" && error) return error;
  }
  return null;
}

function EmptyState({ saveButton }: { saveButton: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-secondary px-4 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-50">
        <Lightbulb aria-hidden="true" className="size-6 text-brand-600" />
      </span>
      <h2 className="mt-3 font-semibold text-primary">No gift ideas yet</h2>
      <p className="mt-1 max-w-md text-sm text-tertiary">
        See something that would make a good gift for someone? Save it here to think about before their next
        birthday or holiday. Only you can see it.
      </p>
      <ul className="mt-4 max-w-md space-y-1.5 text-left text-sm text-secondary">
        <li>• Paste its link into Save a gift idea.</li>
        <li>• In the Regibee app, share it to Regibee from the store&apos;s app or your browser, then pick Gift ideas.</li>
        <li>• With the Regibee extension for Chrome, open it on the product&apos;s page and pick Gift ideas under Add to.</li>
      </ul>
      <div className="mt-6">{saveButton}</div>
    </div>
  );
}

function IdeaCard({
  idea,
  recipients,
  pending,
  onBought,
  dialogProps,
  onSaved,
  onDeleted,
}: {
  idea: GiftIdea;
  recipients: string[];
  pending: boolean;
  onBought: (bought: boolean) => void;
  dialogProps: Pick<GiftIdeasProps, "saveAction" | "deleteAction" | "readLink">;
  onSaved: (saved: { recipient: string; title: string }) => void;
  onDeleted: () => void;
}) {
  const href = webUrl(idea.externalUrl);
  const meta = [idea.price != null ? formatPrice(idea.price) : null, storeDomain(href)].filter(Boolean).join(" · ");
  const bought = Boolean(idea.boughtAt);

  return (
    <li aria-busy={pending || undefined} className="flex flex-col rounded-xl border border-secondary bg-primary p-3 shadow-xs">
      <div className="flex gap-3">
        <ItemImage imageUrl={idea.imageUrl} title={idea.title} className={bought ? "opacity-60" : undefined} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold break-words text-primary">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm outline-focus-ring hover:underline focus-visible:outline-2"
              >
                {idea.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              idea.title
            )}
          </h3>
          {meta && <p className="mt-0.5 truncate text-sm text-tertiary">{meta}</p>}
          {idea.notes && <p className="mt-1 line-clamp-3 text-sm break-words whitespace-pre-line text-secondary">{idea.notes}</p>}
          {bought && (
            <Tag variant="purchased-by-you" className="mt-1.5">
              Bought
            </Tag>
          )}
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Checkbox
            label={
              <>
                Bought it<span className="sr-only">: {idea.title}</span>
              </>
            }
            isSelected={bought}
            isReadOnly={pending}
            onChange={onBought}
          />
          {pending && <span className="text-sm text-tertiary">Saving…</span>}
        </div>
        <GiftIdeaDialog
          idea={idea}
          recipients={recipients}
          {...dialogProps}
          onSaved={onSaved}
          onDeleted={onDeleted}
          trigger={
            <Button variant="outline" size="sm">
              Edit<span className="sr-only"> {idea.title}</span>
            </Button>
          }
        />
      </div>
    </li>
  );
}

function PersonSection({
  group,
  children,
  addButton,
}: {
  group: RecipientGroup;
  children: React.ReactNode;
  addButton: React.ReactNode;
}) {
  const headingId = useId();
  const bought = group.ideas.length - group.openCount;
  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate font-display text-lg font-semibold text-primary">
            For {group.name}
          </h2>
          <p className="text-sm text-tertiary">
            {ideaCount(group.openCount)}
            {bought > 0 && ` · ${bought} bought`}
          </p>
        </div>
        {addButton}
      </div>
      <ul aria-label={`Gift ideas for ${group.name}`} className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </ul>
    </section>
  );
}

export function GiftIdeas({ ideas, openWithLink, saveAction, deleteAction, setBoughtAction = setGiftIdeaBought, readLink }: GiftIdeasProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [notice, setNotice] = useState("");
  const [person, setPerson] = useState<string>("all");

  // "Bought it" ticks you've just made, shown until the server's copy catches up.
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [seenIdeas, setSeenIdeas] = useState(ideas);
  if (ideas !== seenIdeas) {
    setSeenIdeas(ideas);
    setOverrides((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => pendingIds.has(id))));
  }

  const current = useMemo(
    () => ideas.map((idea) => (idea.id in overrides ? { ...idea, boughtAt: overrides[idea.id] } : idea)),
    [ideas, overrides],
  );
  const groups = useMemo(() => groupByRecipient(current), [current]);
  const recipients = useMemo(() => recentRecipients(ideas), [ideas]);
  // A person whose last idea was deleted drops back to everyone.
  const chosen = groups.find((g) => g.key === person) ?? null;
  const shown = chosen ? [chosen] : groups;

  const dialogProps = { saveAction, deleteAction, readLink };
  const refresh = () => startRefresh(() => router.refresh());

  const onSaved = (saved: { recipient: string; title: string }) => {
    setNotice(`Saved “${saved.title}” for ${saved.recipient}.`);
    refresh();
  };
  const onDeleted = (title: string) => {
    setNotice(`Deleted “${title}”.`);
    refresh();
  };

  const markBought = async (idea: GiftIdea, bought: boolean) => {
    setNotice("");
    const before = idea.boughtAt;
    setOverrides((prev) => ({ ...prev, [idea.id]: bought ? new Date().toISOString() : null }));
    setPendingIds((prev) => new Set(prev).add(idea.id));
    let message: string | null;
    try {
      message = errorOf(await setBoughtAction(idea.id, bought));
    } catch {
      message = "That didn't save. Try again in a moment.";
    }
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(idea.id);
      return next;
    });
    if (message) {
      setOverrides((prev) => ({ ...prev, [idea.id]: before }));
      setNotice(message);
      return;
    }
    refresh();
  };

  const saveButton = (
    <GiftIdeaDialog
      recipients={recipients}
      defaultRecipient={chosen?.name}
      openWithLink={openWithLink}
      {...dialogProps}
      onSaved={onSaved}
      trigger={
        <Button>
          <span className="inline-flex items-center gap-1.5">
            <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
            Save a gift idea
          </span>
        </Button>
      }
    />
  );

  return (
    <div className="container mx-auto px-4 pt-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="sr-only">Gift ideas</h1>
          <p className="flex items-start gap-1.5 text-tertiary">
            <Lock aria-hidden="true" className="mt-1 size-4 shrink-0" />
            Gifts you might give other people. Only you can see these.
          </p>
        </div>
        {ideas.length > 0 && <div className="shrink-0">{saveButton}</div>}
      </div>

      {ideas.length === 0 ? (
        <EmptyState saveButton={saveButton} />
      ) : (
        <>
          {groups.length > 1 && (
            <AriaToggleButtonGroup
              aria-label="Whose ideas to show"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[chosen ? chosen.key : "all"]}
              onSelectionChange={(keys) => {
                const [key] = [...keys];
                if (key !== undefined) setPerson(String(key));
              }}
              className="scrollbar-hide mt-6 flex max-w-full gap-1.5 overflow-x-auto"
            >
              {[{ key: "all", name: "Everyone", count: current.filter((i) => !i.boughtAt).length }, ...groups.map((g) => ({ key: g.key, name: g.name, count: g.openCount }))].map(
                (option) => (
                  <AriaToggleButton
                    key={option.key}
                    id={option.key}
                    className={({ isSelected, isFocusVisible }) =>
                      cx(
                        "inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap outline-focus-ring transition-colors",
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-secondary text-secondary ring-1 ring-secondary ring-inset hover:bg-tertiary",
                        isFocusVisible && "outline-2 outline-offset-2",
                      )
                    }
                  >
                    {({ isSelected }) => (
                      <>
                        {option.name}
                        <span
                          className={cx(
                            "rounded-full px-1.5 text-xs font-medium tabular-nums",
                            isSelected ? "bg-white/20 text-white" : "bg-primary text-tertiary",
                          )}
                        >
                          {option.count}
                        </span>
                      </>
                    )}
                  </AriaToggleButton>
                ),
              )}
            </AriaToggleButtonGroup>
          )}

          <p role="status" className="mt-3 min-h-5 text-sm text-secondary">
            {notice}
          </p>

          <div className="mt-3 space-y-8">
            {shown.map((group) => (
              <PersonSection
                key={group.key}
                group={group}
                addButton={
                  <GiftIdeaDialog
                    recipients={recipients}
                    defaultRecipient={group.name}
                    {...dialogProps}
                    onSaved={onSaved}
                    trigger={
                      <Button variant="outline" size="sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                          Add an idea<span className="sr-only"> for {group.name}</span>
                        </span>
                      </Button>
                    }
                  />
                }
              >
                {group.ideas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    recipients={recipients}
                    pending={pendingIds.has(idea.id)}
                    onBought={(bought) => markBought(idea, bought)}
                    dialogProps={dialogProps}
                    onSaved={onSaved}
                    onDeleted={() => onDeleted(idea.title)}
                  />
                ))}
              </PersonSection>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
