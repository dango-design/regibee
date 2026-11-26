"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTION_SCROLL_MARGIN, SectionTitle } from "@/components/section-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ConfirmDeleteDialog, DeletionLines } from "@/components/confirm-delete-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { accountDeletionLines, type AccountDeletionSummary } from "@/lib/account-deletion-summary";
import { accountHasData, deletePhrase } from "@/lib/delete-confirmation";
import { cx } from "@/lib/utils/cx";

type Result = { error?: string };

async function loadFromApi(): Promise<AccountDeletionSummary> {
  const response = await fetch("/api/account", { cache: "no-store" });
  if (!response.ok) throw new Error("We couldn't check your account. Try again.");
  return response.json();
}

async function deleteWithApi(): Promise<Result> {
  try {
    const response = await fetch("/api/account", { method: "DELETE" });
    if (response.ok) return {};
    const body = await response.json().catch(() => null);
    return { error: body?.error ?? "We couldn't delete your account. Try again." };
  } catch {
    return { error: "We couldn't reach Regibee. Check your connection and try again." };
  }
}

/**
 * The Account page's last card. Its dialog says what deleting the account
 * does. An account with a registry or an event also asks the person to type
 * a sentence first. Then it deletes the account with DELETE /api/account,
 * signs out and goes to the home page.
 */
export function DeleteAccountCard({
  loadSummary = loadFromApi,
  deleteAction = deleteWithApi,
}: {
  /** Stand-ins for the API. The demo and stories pass them. */
  loadSummary?: () => Promise<AccountDeletionSummary>;
  deleteAction?: () => Promise<Result>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<AccountDeletionSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setSummary(null);
    setLoadError("");
    try {
      setSummary(await loadSummary());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "We couldn't check your account. Try again.");
    }
  };

  const openDialog = () => {
    setError("");
    setOpen(true);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    const result = await deleteAction();
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    // The account and its sessions are gone. This clears the browser's copy.
    const { createClient } = await import("@/utils/supabase/client");
    await createClient().auth.signOut({ scope: "local" });
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <Card id="delete-account" className={cx("border-error-primary/50", SECTION_SCROLL_MARGIN)}>
        <CardHeader>
          <SectionTitle sectionId="delete-account">Delete account</SectionTitle>
          <CardDescription>
            Deletes your account, lists, events and profile. This can&apos;t be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive-outline" onClick={openDialog}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="This can't be undone. Deleting your account does this:"
        phrase={summary && accountHasData(summary) ? deletePhrase("account") : null}
        confirmLabel="Delete account"
        working={deleting}
        ready={summary !== null}
        error={error}
        onConfirm={handleDelete}
      >
        {loadError ? (
          <div className="space-y-3">
            <p className="text-sm text-error-primary">{loadError}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        ) : summary ? (
          <DeletionLines lines={accountDeletionLines(summary)} />
        ) : (
          <div className="space-y-2" aria-label="Checking your account" role="status">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </ConfirmDeleteDialog>
    </>
  );
}
