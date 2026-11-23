"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/base/input/input";
import { filledGuestRows, readGuestRows, type ParsedGuest } from "@/lib/guest-input";
import { cx } from "@/lib/utils/cx";

interface Row {
  id: number;
  name: string;
  email: string;
}

const emptyRow = (id: number): Row => ({ id, name: "", email: "" });

/**
 * The add guests form on an event's guest list: a name and an optional email
 * on each row. "Add another guest" adds a row, so a host can add several
 * people in one go without pasting a list. Rows left blank are skipped
 * (readGuestRows in src/lib/guest-input.ts, which the phone app uses too).
 */
export function GuestRowsForm({
  adding,
  onAdd,
  onInvalid,
}: {
  adding: boolean;
  /** Adds the guests. Resolves true when they were added, to empty the form. */
  onAdd: (guests: ParsedGuest[]) => Promise<boolean>;
  /** A row needs fixing before anything is sent. */
  onInvalid: (message: string) => void;
}) {
  const nextId = useRef(1);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(0)]);
  const [invalid, setInvalid] = useState<{ id: number; field: "name" | "email" } | null>(null);
  const filled = filledGuestRows(rows);

  const change = (id: number, field: "name" | "email", value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    if (invalid?.id === id && invalid.field === field) setInvalid(null);
  };

  const addRow = () => {
    const id = nextId.current++;
    setRows((current) => [...current, emptyRow(id)]);
  };

  const removeRow = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));
    if (invalid?.id === id) setInvalid(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = readGuestRows(rows);
    if (result.guests === null) {
      setInvalid({ id: rows[result.row].id, field: result.field });
      onInvalid(result.error);
      return;
    }
    setInvalid(null);
    if (await onAdd(result.guests)) {
      const id = nextId.current++;
      setRows([emptyRow(id)]);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-3">
      {rows.map((row, index) => {
        const first = index === 0;
        return (
          // On a phone each row's fields stack, so a line between rows keeps
          // each name with its email, and the remove button sits beside both.
          <div
            key={row.id}
            className={cx(
              "flex items-center gap-2 sm:items-end",
              !first && "max-sm:border-t max-sm:border-secondary max-sm:pt-3",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
              {/* A guest's details, not the owner's, so no autofill. */}
              <Input
                label={first ? "Name" : undefined}
                aria-label={first ? undefined : `Guest ${index + 1} name`}
                placeholder={first ? undefined : "Name"}
                value={row.name}
                onChange={(value) => change(row.id, "name", value)}
                isInvalid={invalid?.id === row.id && invalid.field === "name"}
                // A row the host just added: they're about to type in it.
                autoFocus={!first}
                autoComplete="off"
                enterKeyHint="next"
                className="sm:flex-1"
                maxLength={100}
              />
              <Input
                label={first ? "Email (optional)" : undefined}
                aria-label={first ? undefined : `Guest ${index + 1} email`}
                placeholder={first ? undefined : "Email (optional)"}
                type="email"
                value={row.email}
                onChange={(value) => change(row.id, "email", value)}
                isInvalid={invalid?.id === row.id && invalid.field === "email"}
                autoComplete="off"
                enterKeyHint="done"
                className="sm:flex-1"
              />
            </div>
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove row ${index + 1}`}
                onClick={() => removeRow(row.id)}
                className="size-10 shrink-0"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={adding}>
          <span className="inline-flex items-center gap-1.5">
            {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {filled > 1 ? `Add ${filled} guests` : "Add"}
          </span>
        </Button>
        <Button type="button" variant="outline" onClick={addRow} disabled={adding}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="size-4" />
            Add another guest
          </span>
        </Button>
      </div>
    </form>
  );
}
