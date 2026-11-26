"use client";

import { useMemo, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { SearchLg } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InvitablePerson } from "@/lib/events-page-types";

/** Past this many people, the dialog offers a search box. */
const SEARCH_FROM = 8;

/**
 * "Invite people you follow": picks people who approved the host's follow
 * and adds them to the guest list, with the email on their account
 * (inviteFollowedPeople). The host sees that email only when they follow each
 * other (src/lib/guest-emails.ts), which each row says.
 */
export function InviteFollowedDialog({
  people,
  onInvite,
  onClose,
}: {
  people: InvitablePerson[];
  /** Adds the chosen people. Resolves false when it failed and the dialog should stay open. */
  onInvite: (publicIds: string[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return words ? people.filter((person) => person.name.toLowerCase().includes(words)) : people;
  }, [people, query]);
  const available = people.filter((person) => !person.onList).length;

  const toggle = (publicId: string, selected: boolean) => {
    setChosen((current) => {
      const next = new Set(current);
      if (selected) next.add(publicId);
      else next.delete(publicId);
      return next;
    });
  };

  const invite = async () => {
    if (chosen.size === 0) return;
    setBusy(true);
    const ok = await onInvite([...chosen]);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite people you follow</DialogTitle>
          <DialogDescription>
            They&apos;re emailed when you send invitations.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {people.length >= SEARCH_FROM && (
            <Input
              aria-label="Search people you follow"
              placeholder="Search by name"
              icon={SearchLg}
              value={query}
              onChange={setQuery}
              autoComplete="off"
            />
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-tertiary">Nobody you follow matches &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul className="-mx-1 flex max-h-80 flex-col gap-1 overflow-y-auto px-1 py-1">
              {shown.map((person) => (
                <li key={person.publicId} className="rounded-lg px-2 py-2 hover:bg-secondary">
                  <Checkbox
                    size="md"
                    isSelected={person.onList || chosen.has(person.publicId)}
                    isDisabled={person.onList || busy}
                    onChange={(selected) => toggle(person.publicId, selected)}
                    label={person.name}
                    hint={
                      person.onList
                        ? "Already on the guest list"
                        : person.mutual
                          ? "You follow each other"
                          : "Their email stays private"
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-tertiary">
              {available === 0 ? "Everyone you follow is on the list." : `${chosen.size} of ${available} chosen`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={invite} disabled={busy || chosen.size === 0}>
                <span className="inline-flex items-center gap-1.5">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  {chosen.size === 0 ? "Add guests" : chosen.size === 1 ? "Add 1 guest" : `Add ${chosen.size} guests`}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
