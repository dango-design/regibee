"use client";

import { useState } from "react";
import { SECTION_SCROLL_MARGIN, SectionTitle } from "@/components/section-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDeleteDialog, DeletionLines } from "@/components/confirm-delete-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteRegistry, getRegistryDeletionSummary } from "@/lib/actions/registry";
import {
  deletePhrase,
  registryDeletionLines,
  registryHasData,
  type RegistryDeletionSummary,
} from "@/lib/delete-confirmation";
import { cx } from "@/lib/utils/cx";

type LoadSummary = (registryId: string) => Promise<{ summary: RegistryDeletionSummary } | { error: string }>;
type DeleteAction = (registryId: string) => Promise<{ error: string } | undefined | void>;

/**
 * The last card on a registry's Settings page, which only its owner sees. Its
 * dialog says what deleting the registry does. A registry with items or gift
 * funds also asks the owner to type a sentence first.
 */
export function DeleteRegistryCard({
  registryId,
  loadSummary = getRegistryDeletionSummary,
  deleteAction = deleteRegistry,
}: {
  registryId: string;
  /** Stand-ins for the server actions. Stories pass them. */
  loadSummary?: LoadSummary;
  deleteAction?: DeleteAction;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<RegistryDeletionSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setSummary(null);
    setLoadError("");
    try {
      const result = await loadSummary(registryId);
      if ("error" in result) setLoadError(result.error);
      else setSummary(result.summary);
    } catch {
      setLoadError("We couldn't check this registry. Try again.");
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
    try {
      // On success the action redirects to the dashboard, so only errors come back.
      const result = await deleteAction(registryId);
      if (result?.error) {
        setError(result.error);
        setDeleting(false);
      }
    } catch (e) {
      // The redirect arrives as a thrown error that Next.js handles.
      setDeleting(false);
      throw e;
    }
  };

  return (
    <>
      <Card id="delete-registry" className={cx("border-error-primary/50", SECTION_SCROLL_MARGIN)}>
        <CardHeader>
          <SectionTitle
            sectionId="delete-registry"
            className="font-sans leading-none font-semibold tracking-normal text-error-primary"
          >
            Delete registry
          </SectionTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={openDialog}>
            Delete registry
          </Button>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this registry?"
        description="This can't be undone."
        phrase={summary && registryHasData(summary) ? deletePhrase("registry") : null}
        confirmLabel="Delete registry"
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
          <DeletionLines lines={registryDeletionLines(summary)} />
        ) : (
          <div className="space-y-2" aria-label="Checking this registry" role="status">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </ConfirmDeleteDialog>
    </>
  );
}
