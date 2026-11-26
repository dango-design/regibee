"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { cancelReservation } from "@/lib/actions/registry";

interface CancelReservationButtonProps {
  purchaseId: string;
  registryId: string;
}

export function CancelReservationButton({
  purchaseId,
  registryId,
}: CancelReservationButtonProps) {
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = () => {
    setError("");
    setAsking(true);
  };

  // The dialog stays open while the reservation is cancelled, and shows the
  // error if it fails.
  const handleCancel = async () => {
    setLoading(true);
    setError("");
    const result = await cancelReservation(purchaseId, registryId);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setAsking(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={ask}
        disabled={loading}
        className="text-error-primary hover:text-error-primary shrink-0"
      >
        <X className="h-3 w-3 mr-1" />
        Cancel
      </Button>
      <ConfirmActionDialog
        open={asking}
        onOpenChange={setAsking}
        title="Cancel this reservation?"
        description="The item will become available again."
        confirmLabel="Cancel reservation"
        cancelLabel="Keep it"
        working={loading}
        error={error}
        onConfirm={handleCancel}
      />
    </>
  );
}
