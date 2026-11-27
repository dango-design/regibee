"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { deleteEvent, planEventAgain } from "@/lib/actions/events";
import { cancellationNotice } from "@/lib/event-updates";
import { deletePhrase } from "@/lib/delete-confirmation";

type Choice = "plan-again" | "delete";

type PlanAction = (eventId: string) => Promise<{ error: string } | { error: null; id: string }>;
type DeleteAction = (eventId: string) => Promise<{ error: string | null } | undefined | void>;

/**
 * The "More actions" menu beside Edit on an event's page. It holds actions
 * hosts use rarely: "Plan it again" and, for the owner, "Delete event". Each
 * one opens a dialog that says what it does and asks before doing it.
 */
export function EventActionsMenu({
  eventId,
  isOwner,
  guestCount,
  cancellationCount = 0,
  planAction = planEventAgain,
  deleteAction = deleteEvent,
}: {
  eventId: string;
  /** Only the owner can delete the event. */
  isOwner: boolean;
  guestCount: number;
  /** How many guests get the "cancelled" email if the event is deleted (cancellationRecipients). */
  cancellationCount?: number;
  /** Stand-ins for the server actions. The demo and stories pass them. */
  planAction?: PlanAction;
  deleteAction?: DeleteAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Choice | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const choose = (choice: Choice) => {
    setError("");
    setOpen(choice);
  };

  // The dialog stays open while the action runs.
  const onOpenChange = (value: boolean) => {
    if (!value && !working) setOpen(null);
  };

  const planAgain = async () => {
    setWorking(true);
    setError("");
    const result = await planAction(eventId);
    if (result.error !== null) {
      setError(result.error);
      setWorking(false);
      return;
    }
    router.push(`/dashboard/events/${result.id}/edit`);
  };

  const remove = async () => {
    setWorking(true);
    setError("");
    const result = await deleteAction(eventId);
    // On success the action redirects, so only errors come back.
    if (result?.error) {
      setError(result.error);
      setWorking(false);
    }
  };

  return (
    <>
      <Dropdown.Root>
        {/* size-9 matches the height of the Share Link, Preview and Edit buttons beside it. */}
        <Button variant="outline" size="icon" aria-label="More actions" className="size-9">
          <MoreHorizontal className="size-4" />
        </Button>
        <Dropdown.Popover placement="bottom end" className="w-56">
          <Dropdown.Menu
            aria-label="More actions"
            selectionMode="none"
            onAction={(key) => choose(key as Choice)}
          >
            <Dropdown.Item id="plan-again" icon={Repeat} label="Plan it again" />
            {isOwner && <Dropdown.Separator />}
            {isOwner && <Dropdown.Item id="delete" icon={Trash2} label="Delete event" destructive />}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>

      <Dialog open={open === "plan-again"} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan this event again?</DialogTitle>
            <DialogDescription>
              A new event a year later, with the same guests and settings. Replies start over. No one is emailed.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)} disabled={working}>
              Cancel
            </Button>
            <Button onClick={planAgain} disabled={working}>
              <span className="inline-flex items-center gap-1.5">
                {working && <Loader2 className="size-4 animate-spin" />}
                Plan it again
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isOwner && (
        <ConfirmDeleteDialog
          open={open === "delete"}
          onOpenChange={onOpenChange}
          title="Delete this event?"
          description={[
            guestCount > 0
              ? `The event page stops working and the guest list of ${guestCount} is deleted.`
              : "The event page stops working.",
            cancellationNotice(cancellationCount),
            "This can't be undone.",
          ]
            .filter(Boolean)
            .join(" ")}
          // An event with guests asks the owner to type a sentence first.
          phrase={guestCount > 0 ? deletePhrase("event") : null}
          confirmLabel="Delete event"
          cancelLabel="Keep it"
          working={working}
          error={error}
          onConfirm={remove}
        />
      )}
    </>
  );
}
