"use client";

import { useState } from "react";
import { DollarSign, Check } from "lucide-react";
import { Mail01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Input, InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { TextArea } from "@/components/base/textarea/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodsDisplay } from "@/components/payment-methods-display";
import { contributeToCashFund } from "@/lib/actions/registry";
import { CelebrationDialog } from "@/components/celebration-dialog";
import type { PaymentMethods } from "@/lib/types";
import { formatDollars, formatPrice } from "@/lib/money";
import { useGuestPrefill } from "@/components/guest-prefill-context";

type DialogAction = (formData: FormData) => Promise<{ error: string } | undefined>;

interface ContributeFundDialogProps {
  fund: {
    id: string;
    title: string;
    description: string | null;
    goal_amount: number | null;
    current_amount: number;
  };
  paymentMethods?: PaymentMethods;
  parentName?: string;
  action?: DialogAction;
  alreadyPurchased?: boolean;
  /** What this guest gave to the fund so far, in all. */
  previousAmount?: number;
  shippingAddress?: string;
  /** The demo registry: pay buttons don't open anything. */
  demo?: boolean;
}

export function ContributeFundDialog({
  fund,
  paymentMethods,
  parentName = "The parents",
  action,
  alreadyPurchased,
  previousAmount,
  shippingAddress,
  demo,
}: ContributeFundDialogProps) {
  // A guest from an event invitation: their name and email start filled in.
  const prefill = useGuestPrefill();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(alreadyPurchased ?? false);
  const [showCelebration, setShowCelebration] = useState(false);
  // The last gift, for the thank-you, and everything this guest gave, for the card.
  const [contributedAmount, setContributedAmount] = useState<number>(previousAmount ?? 0);
  const [totalGiven, setTotalGiven] = useState<number>(previousAmount ?? 0);

  const remaining =
    fund.goal_amount != null
      ? Math.max(0, fund.goal_amount - fund.current_amount)
      : null;

  const fundProgress =
    fund.goal_amount && fund.goal_amount > 0
      ? (fund.current_amount / fund.goal_amount) * 100
      : 0;

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");
    formData.set("fundId", fund.id);

    const result = await (action ?? contributeToCashFund)(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      const amount = Number(formData.get("amount")) || 0;
      setContributedAmount(amount);
      setTotalGiven((total) => total + amount);
      setSuccess(true);
      setOpen(false);
      setShowCelebration(true);
    }
    setLoading(false);
  };

  // A fund is never done: after giving, the guest sees what they gave and can
  // give again. Only a goal that's been reached stops more gifts, since the
  // database refuses a gift past the goal.
  const canGive = remaining == null || remaining > 0;
  const contributeButton = (
    <Button className="!bg-mint-500 hover:!bg-mint-600 !ring-mint-500 !text-brand-900" onClick={() => setOpen(true)}>
      <span className="inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4 shrink-0" />Contribute</span>
    </Button>
  );

  return (
    <>
      {success ? (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary">
            <Check className="h-4 w-4 shrink-0 text-success-primary" />
            {totalGiven > 0 ? `You gave ${formatPrice(totalGiven)}` : "You gave"}
          </span>
          <button
            type="button"
            onClick={() => setShowCelebration(true)}
            className="text-xs font-medium text-brand-tertiary hover:underline max-sm:min-h-11 max-sm:px-2"
          >
            View details
          </button>
          {canGive && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <span className="inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4 shrink-0" />Give again</span>
            </Button>
          )}
        </div>
      ) : (
        contributeButton
      )}
      <CelebrationDialog
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        itemTitle={fund.title}
        parentName={parentName}
        variant="contribute"
        amount={contributedAmount}
        paymentMethods={paymentMethods}
        demo={demo}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Contribute to &ldquo;{fund.title}&rdquo;</DialogTitle>
            <DialogDescription>
              You send the money to them directly.
            </DialogDescription>
          </DialogHeader>
  
          {fund.goal_amount != null && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span>{formatDollars(fund.current_amount)} raised</span>
                <span>{formatDollars(fund.goal_amount)} goal</span>
              </div>
              <Progress value={fundProgress} aria-label={`Amount raised for ${fund.title}`} />
              {remaining != null && remaining > 0 && (
                <span className="text-xs">
                  {formatDollars(remaining)} remaining
                </span>
              )}
            </div>
          )}
  
          {/* No amount up here. The goal is in the progress row above, and a big
              number next to "Send payment via" reads like the price to pay. */}
          <div className="flex flex-col gap-2 overflow-hidden rounded-xl px-4">
            <PaymentMethodsDisplay paymentMethods={paymentMethods} />
          </div>
  
          <form action={handleSubmit} className="space-y-4">
            {/* Amounts are saved in dollars, like every amount on Regibee. An
                icon, not InputGroup's prefix: the prefix only sits inside the
                field's border when the group also holds a select. */}
            <InputGroup label="Amount" isRequired>
              <InputBase
                icon={DollarSign}
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={1}
                max={remaining ?? undefined}
                placeholder="0.00"
              />
            </InputGroup>
            <Input
              label="Your Name"
              name="buyerName"
              placeholder="Alex Kim"
              autoComplete="name"
              enterKeyHint="next"
              defaultValue={prefill?.name || undefined}
              isRequired
            />
            <Input
              label="Your Email"
              name="buyerEmail"
              type="email"
              placeholder="alex@example.com"
              autoComplete="email"
              enterKeyHint="next"
              icon={Mail01}
              defaultValue={prefill?.email || undefined}
              isRequired
            />
            <TextArea
              label="Message (optional)"
              name="message"
              placeholder="Congratulations!"
              rows={3}
            />
  
            {error && <p className="text-sm text-error-primary">{error}</p>}
  
            <DialogFooter sticky>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Contributing..." : "Contribute"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
