"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { CurrencySelect } from "@/components/currency-select";
import { TextArea } from "@/components/base/textarea/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addCashFund } from "@/lib/actions/registry";
import type { PaymentMethods } from "@/lib/types";

interface AddCashFundDialogProps {
  registryId: string;
  /**
   * The list's payment methods, which guests send the money to: null when it
   * has none. Leave it out while they're still loading: the dialog then
   * neither shows nor saves them, so blank fields never replace saved ones.
   */
  paymentMethods?: PaymentMethods | null;
  /** What the fields start with, such as a checklist entry's name and description. */
  defaults?: { title?: string; description?: string };
  /** Opens the dialog from outside, with no button of its own. Pass with onOpenChange. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Runs after the fund is saved. */
  onCreated?: () => void;
  /** A stand-in for the server action. The demo passes one. */
  action?: typeof addCashFund;
}

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
};

const METHODS = [
  { name: "venmo", label: "Venmo", placeholder: "@your-venmo" },
  { name: "paypal", label: "PayPal", placeholder: "you@email.com or PayPal.me link" },
  { name: "zelle", label: "Zelle", placeholder: "you@email.com or phone number" },
] as const;

function hasMethods(methods: PaymentMethods | null | undefined): boolean {
  return !!(methods?.venmo || methods?.paypal || methods?.zelle);
}

export function AddCashFundDialog({
  registryId,
  paymentMethods,
  defaults,
  open: openProp,
  onOpenChange,
  onCreated,
  action = addCashFund,
}: AddCashFundDialogProps) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("USD");
  // With no payment methods yet, the fields show right away. Otherwise the
  // saved ones show as text, with Edit to change them here.
  const [editingMethods, setEditingMethods] = useState(!hasMethods(paymentMethods));
  const methodsKnown = paymentMethods !== undefined;

  const setOpen = (next: boolean) => {
    if (!controlled) setOpenState(next);
    onOpenChange?.(next);
    if (next) {
      setError("");
      setEditingMethods(!hasMethods(paymentMethods));
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");
    if (methodsKnown && editingMethods) formData.set("savePaymentMethods", "1");
    const result = await action(registryId, formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
      const title = String(formData.get("title") ?? "").trim();
      toast.success(title ? `"${title}" created` : "Gift fund created");
      onCreated?.();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <span className="inline-flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 shrink-0" />
              Add Fund
            </span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Create gift fund</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            label="Fund Name"
            name="title"
            placeholder="e.g., Diaper Fund"
            defaultValue={defaults?.title}
            isRequired
          />

          <TextArea
            label="Description (optional)"
            name="description"
            placeholder="What's this fund for?"
            defaultValue={defaults?.description}
            rows={3}
          />

          <InputGroup
            label="Goal Amount (optional)"
            name="goalAmount"
            prefix={currencySymbols[currency] || "$"}
            trailingAddon={<CurrencySelect value={currency} onChange={setCurrency} />}
          >
            <InputBase
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder="0.00"
            />
          </InputGroup>

          {methodsKnown && (
          <div role="group" aria-labelledby="fund-payment-methods" className="space-y-3 rounded-xl border border-secondary p-4">
            <div className="flex items-center justify-between gap-2">
              <p id="fund-payment-methods" className="text-sm font-medium text-secondary">Where guests send money</p>
              {!editingMethods && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingMethods(true)}>
                  Edit
                </Button>
              )}
            </div>
            {editingMethods ? (
              <>
                <p className="text-sm text-tertiary">Guests pay you directly. Regibee never handles money.</p>
                {METHODS.map((method) => (
                  <Input
                    key={method.name}
                    label={method.label}
                    name={method.name}
                    placeholder={method.placeholder}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    defaultValue={paymentMethods?.[method.name] || ""}
                  />
                ))}
              </>
            ) : (
              <dl className="space-y-1.5">
                {METHODS.filter((method) => paymentMethods?.[method.name]).map((method) => (
                  <div key={method.name} className="flex items-center gap-2 text-sm">
                    <dt className="w-14 shrink-0 font-medium text-tertiary">{method.label}</dt>
                    <dd className="min-w-0 break-all text-primary">{paymentMethods?.[method.name]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          )}

          {error && <p className="text-sm text-error-primary">{error}</p>}

          <DialogFooter sticky>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create fund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
