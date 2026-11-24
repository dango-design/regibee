// Deleting the account from the app, which Apple requires of apps that make
// accounts. The website's server does the work (src/app/api/account/route.ts):
// it needs the service-role key, which the app doesn't have. The app sends
// its session's access token, so the server only ever deletes this account.

import { useState } from "react";
import { Alert, Platform } from "react-native";

import { accountDeletionLines, type AccountDeletionSummary } from "@shared/account-deletion-summary";
import { accountHasData, deletePhrase } from "@shared/delete-confirmation";

import { haptic } from "@/components/ui";
import { signOut, useSession } from "@/lib/auth";
import { clearCache } from "@/lib/query";
import { SITE_URL, supabase } from "@/lib/supabase";

async function callAccountApi(method: "GET" | "DELETE") {
  // getSession refreshes the token first if it has run out.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign out, sign in again, then try again.");

  let response: Response;
  try {
    response = await fetch(`${SITE_URL}/api/account`, { method, headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("We couldn't reach Regibee. Check your connection and try again.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Something went wrong. Try again.");
  return body;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function tell(title: string, text: string) {
  if (Platform.OS === "web") globalThis.alert?.(`${title}\n\n${text}`);
  else Alert.alert(title, text);
}

/**
 * The Account tab's "Delete account" row. It asks the server what deleting
 * the account would do and shows that in a dialog. An account with a registry
 * or an event also has to type a sentence there. Then it deletes the account,
 * clears the cache and signs out.
 *
 * The screen shows the dialog: `<ConfirmDelete {...deletion.dialog} />`.
 */
export function useDeleteAccount() {
  const { demo } = useSession();
  // What the row is waiting for, if anything.
  const [status, setStatus] = useState<"checking" | "deleting" | null>(null);
  // Set while the dialog is open.
  const [summary, setSummary] = useState<AccountDeletionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (status) return;
    if (demo) {
      tell(
        "There's no account to delete",
        "This is the demo. It doesn't have an account, and nothing in it is saved. If you make an account, you can delete it here.",
      );
      return;
    }

    setStatus("checking");
    try {
      const loaded: AccountDeletionSummary = await callAccountApi("GET");
      haptic("warning");
      setError(null);
      setSummary(loaded);
    } catch (e) {
      tell("We couldn't check your account", message(e));
    } finally {
      setStatus(null);
    }
  }

  async function confirm() {
    setStatus("deleting");
    setError(null);
    try {
      await callAccountApi("DELETE");
    } catch (e) {
      setStatus(null);
      setError(message(e));
      return;
    }
    // The account and its sessions are gone on the server. These clear the
    // phone's copies. Signing out shows the sign-in screen.
    setSummary(null);
    await clearCache();
    await signOut();
    haptic("success");
    tell("Your account is deleted", "Thanks for using Regibee.");
  }

  const dialog = {
    visible: summary !== null,
    onClose: () => setSummary(null),
    title: "Delete your account?",
    message: "This can't be undone. Deleting your account does this:",
    lines: summary ? accountDeletionLines(summary) : undefined,
    phrase: summary && accountHasData(summary) ? deletePhrase("account") : null,
    confirmLabel: "Delete account",
    working: status === "deleting",
    error,
    onConfirm: confirm,
  };

  return { status, start, dialog };
}
