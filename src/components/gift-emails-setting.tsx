"use client";

import { useState } from "react";
import { SelectField } from "@/components/base/select/select-field";
import { setGiftEmails } from "@/lib/actions/gift-profile";
import { GIFT_EMAIL_CHOICES, GIFT_EMAILS_HINT, parseGiftEmails, type GiftEmails } from "@/lib/gift-emails";

/**
 * The Account page choice for gift emails: one per gift, one summary a day,
 * or none. It saves as soon as it changes, since the Unsubscribe link mail
 * apps show on those emails lands here.
 */
export function GiftEmailsSetting({
  initial,
  action = setGiftEmails,
}: {
  initial: GiftEmails;
  /** Saves the choice. Stories and the demo pass a stand-in. */
  action?: (choice: string) => Promise<{ success?: boolean; error?: string | null }>;
}) {
  const [choice, setChoice] = useState<GiftEmails>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function change(next: string) {
    const value = parseGiftEmails(next);
    const before = choice;
    setChoice(value);
    setSaving(true);
    setError("");
    const result = await action(value);
    if (result?.error) {
      setChoice(before);
      setError(result.error);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <SelectField
        label="Email me about gifts"
        className="max-w-xs"
        value={choice}
        disabled={saving}
        onChange={change}
        options={GIFT_EMAIL_CHOICES}
        hint={GIFT_EMAILS_HINT}
      />
      {error && <p className="text-sm text-error-primary">{error}</p>}
    </div>
  );
}
