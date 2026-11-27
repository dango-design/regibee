"use client";

import { useState } from "react";
import { DollarSign, Lightbulb, Loader2 } from "lucide-react";
import { Link01, Mail01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Input, InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { Label } from "@/components/base/input/label";
import { TextArea } from "@/components/base/textarea/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { suggestItem } from "@/lib/actions/registry";
import { toWebUrl } from "@/lib/web-url";

type DialogAction = (formData: FormData) => Promise<{ error: string } | undefined>;

/**
 * It asks only for what suggestItem saves: the name, link, price, why, and
 * who's suggesting it. Prices are in dollars, like everything on Regibee.
 */
interface SuggestItemDialogProps {
  registryId: string;
  action?: DialogAction;
}

export function SuggestItemDialog({ registryId, action }: SuggestItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const openableUrl = toWebUrl(externalUrl);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");
    formData.set("registryId", registryId);
    // Prepend protocol if the visual http:// prefix was relied on
    const externalUrl = formData.get("externalUrl") as string;
    if (externalUrl && !/^https?:\/\//i.test(externalUrl)) {
      formData.set("externalUrl", `http://${externalUrl}`);
    }

    const result = await (action ?? suggestItem)(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setSuccess(false);
      setError("");
      setExternalUrl("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <span className="inline-flex items-center gap-2">
            <Lightbulb className="h-5 w-5 shrink-0" />
            Suggest an item
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton={false}>
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle>Thank you!</DialogTitle>
              <DialogDescription>
                We sent your suggestion to the list&apos;s owner.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Suggest an item</DialogTitle>
              <DialogDescription>
                We&apos;ll let the list&apos;s owner know.
              </DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <Input
                label="Item name"
                name="title"
                placeholder="e.g. Baby Monitor"
                isRequired
              />

              <div className="space-y-1.5">
                <Label>Product URL (optional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    name="externalUrl"
                    aria-label="Product URL (optional)"
                    placeholder="https://www.example.com"
                    onChange={setExternalUrl}
                    inputMode="url"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                    enterKeyHint="next"
                    className="flex-1"
                  />
                  {/* Lets the guest check the link before sending it. Disabled until the field holds a web address. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="Open link in a new tab"
                    disabled={!openableUrl}
                    onClick={() => {
                      if (openableUrl) window.open(openableUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Link01 className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* An icon, not InputGroup's prefix: the prefix only sits inside
                  the field's border when the group also holds a select. */}
              <InputGroup label="Estimated price (optional)">
                <InputBase
                  icon={DollarSign}
                  name="price"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                />
              </InputGroup>

              <TextArea
                label="Why do you recommend this? (optional)"
                name="notes"
                placeholder="Enter a description..."
                rows={3}
              />

              <Input
                label="Your Name"
                name="suggestedByName"
                placeholder="Alex Kim"
                autoComplete="name"
                enterKeyHint="next"
                isRequired
              />
              <Input
                label="Your Email"
                name="suggestedByEmail"
                type="email"
                placeholder="alex@example.com"
                autoComplete="email"
                enterKeyHint="done"
                icon={Mail01}
                isRequired
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
                  {loading ? "Submitting..." : "Suggest item"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
