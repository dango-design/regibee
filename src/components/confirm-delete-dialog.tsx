"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/base/input/input";
import { matchesDeletePhrase } from "@/lib/delete-confirmation";

/**
 * The dialog that asks before deleting a registry, an event, a group or an
 * account. With a `phrase`, the delete button stays off until the person has
 * typed that sentence. Pass one when the thing holds something, and null when
 * it's brand new (src/lib/delete-confirmation.ts decides which).
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  phrase,
  confirmLabel,
  cancelLabel = "Cancel",
  working = false,
  ready = true,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** More about what gets deleted, shown under the description. */
  children?: ReactNode;
  /** The sentence to type, or null to ask with the buttons alone. */
  phrase: string | null;
  confirmLabel: string;
  cancelLabel?: string;
  /** The delete is running. The dialog stays open and its buttons are off. */
  working?: boolean;
  /** False while the dialog is still loading what it shows. The delete button stays off. */
  ready?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  // Start with an empty field each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped("");
  }

  const confirmed = phrase === null || matchesDeletePhrase(typed, phrase);
  const canDelete = confirmed && ready && !working;

  return (
    <Dialog open={open} onOpenChange={(next) => !working && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canDelete) onConfirm();
          }}
          className="space-y-4"
        >
          {phrase !== null && (
            <Input
              label={`Type “${phrase}” to confirm`}
              value={typed}
              onChange={setTyped}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              isDisabled={working}
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-error-primary">
              {error}
            </p>
          )}
          <DialogFooter sticky>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant="destructive" disabled={!canDelete}>
              {working ? "Deleting…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The dialog's list of what deleting does, or a skeleton while it loads. */
export function DeletionLines({ lines }: { lines: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm text-secondary">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
