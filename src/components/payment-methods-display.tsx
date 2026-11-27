"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PaymentMethods } from "@/lib/types";
import { paypalPayUrl, venmoPayUrl } from "@/lib/payment-links";

interface PaymentMethodsDisplayProps {
  paymentMethods?: PaymentMethods;
}

function hasPaymentMethod(paymentMethods?: PaymentMethods): paymentMethods is PaymentMethods {
  return !!paymentMethods && !!(paymentMethods.venmo || paymentMethods.paypal || paymentMethods.zelle);
}

/** The owners' handles as plain text, in a gift fund's form before the guest says how much. */
export function PaymentMethodsDisplay({
  paymentMethods,
}: PaymentMethodsDisplayProps) {
  if (!hasPaymentMethod(paymentMethods)) {
    return (
      <p className="text-sm text-tertiary">
        Ask the owner how to pay them.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Send payment via:</p>
      <div className="space-y-1.5">
        {paymentMethods.venmo && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-tertiary w-14">
              Venmo
            </span>
            <span className="min-w-0 break-all">{paymentMethods.venmo}</span>
          </div>
        )}
        {paymentMethods.paypal && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-tertiary w-14">
              PayPal
            </span>
            <span className="min-w-0 break-all">{paymentMethods.paypal}</span>
          </div>
        )}
        {paymentMethods.zelle && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-tertiary w-14">
              Zelle
            </span>
            <span className="min-w-0 break-all">{paymentMethods.zelle}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PayLink({ href, service, demo }: { href: string; service: string; demo?: boolean }) {
  const label = (
    <span className="inline-flex items-center gap-1.5">
      Pay with {service}
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
    </span>
  );
  // The demo's handles may belong to real people, so its buttons go nowhere.
  if (demo) {
    return (
      <button type="button" className={buttonVariants({ variant: "outline", className: "w-full" })}>
        {label}
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "outline", className: "w-full" })}
    >
      {label}
    </a>
  );
}

/**
 * One payment method: its name, the handle with a Copy button, and a Pay
 * button when we can build a link. The handle is always there to copy, in
 * case the link doesn't open the app on the guest's phone.
 */
function PaymentMethodCard({
  service,
  handle,
  href,
  hint,
  demo,
}: {
  service: string;
  handle: string;
  href: string | null;
  /** Shown only when there's no Pay button. */
  hint: string;
  demo?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(handle)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };
  return (
    <div className="space-y-2 rounded-lg border border-primary px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-primary">{service}</p>
          <p className="break-all text-secondary">{handle}</p>
          {!href && <p className="text-xs text-tertiary">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? `Copied ${service} handle` : `Copy ${service} handle`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
        >
          <span className="inline-flex items-center gap-1.5">
            {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      {href && <PayLink href={href} service={service} demo={demo} />}
    </div>
  );
}

interface PaymentOptionsProps {
  paymentMethods?: PaymentMethods;
  /** Filled in where the service takes an amount. Leave out when it's unknown. */
  amount?: number | null;
  /** Filled in where the service takes a note (Venmo only). */
  note?: string;
  parentName: string;
  /** The demo registry: pay buttons don't open anything. */
  demo?: boolean;
}

/**
 * A card per payment method with a Copy button for the handle. Venmo, and
 * PayPal with a PayPal.Me name, also get a button that opens the app with the
 * amount filled in. A PayPal email or a Zelle handle can only be copied.
 */
export function PaymentOptions({ paymentMethods, amount, note, parentName, demo }: PaymentOptionsProps) {
  if (!hasPaymentMethod(paymentMethods)) {
    return (
      <p className="text-sm text-secondary">
        No Venmo, PayPal or Zelle yet. Ask {parentName} how to send it.
      </p>
    );
  }

  const venmoUrl = venmoPayUrl({ handle: paymentMethods.venmo, amount, note });
  const paypalUrl = paypalPayUrl({ handle: paymentMethods.paypal, amount });

  return (
    <div className="grid gap-2">
      {paymentMethods.venmo && (
        <PaymentMethodCard
          service="Venmo"
          handle={paymentMethods.venmo}
          href={venmoUrl}
          hint="Send it in the Venmo app."
          demo={demo}
        />
      )}
      {paymentMethods.paypal && (
        <PaymentMethodCard
          service="PayPal"
          handle={paymentMethods.paypal}
          href={paypalUrl}
          hint="Send it in PayPal."
          demo={demo}
        />
      )}
      {paymentMethods.zelle && (
        <PaymentMethodCard
          service="Zelle"
          handle={paymentMethods.zelle}
          href={null}
          hint="Send it from your bank's app."
        />
      )}
      {demo && (venmoUrl || paypalUrl) && (
        <p className="text-xs text-tertiary">In the demo, these buttons don&apos;t open Venmo or PayPal.</p>
      )}
    </div>
  );
}
