"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, LogOut, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/base/input/input";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { createCoHostLink, inviteCoHost, removeCoHost, revokeCoHostInvite } from "@/lib/actions/events";
import { isEmail } from "@/lib/events";

type ActionResult = { error: string | null };

export interface CoHostActions {
  invite: (eventId: string, email: string) => Promise<ActionResult>;
  createLink: (eventId: string) => Promise<ActionResult & { token?: string }>;
  revoke: (eventId: string, inviteId: string) => Promise<ActionResult>;
  remove: (eventId: string, userId: string) => Promise<ActionResult>;
}

const DEFAULT_ACTIONS: CoHostActions = {
  invite: inviteCoHost,
  createLink: createCoHostLink,
  revoke: revokeCoHostInvite,
  remove: removeCoHost,
};

export interface EventCoHostsProps {
  eventId: string;
  hosts: { userId: string; name: string; isOwner: boolean }[];
  invites: { id: string; email: string | null; expires_at: string }[];
  viewerId: string;
  actions?: Partial<CoHostActions>;
}

/**
 * Who hosts the event, and inviting more co-hosts. On the host's event page.
 * Removing a co-host, leaving and taking back an invitation are in each row's
 * "…" menu, so they can't be clicked by accident. Removing and leaving ask first.
 */
export function EventCoHosts({ eventId, hosts, invites, viewerId, actions: overrides }: EventCoHostsProps) {
  const router = useRouter();
  const actions = { ...DEFAULT_ACTIONS, ...overrides };
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const viewerIsOwner = hosts.some((h) => h.isOwner && h.userId === viewerId);
  // The co-host whose removal (or the viewer's own leaving) waits for a yes.
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);
  const [removeError, setRemoveError] = useState("");
  const leaving = removing?.userId === viewerId;

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError("");
    const result = await actions.remove(eventId, removing.userId);
    setBusy(false);
    if (result.error) {
      setRemoveError(result.error);
      return;
    }
    setRemoving(null);
    router.refresh();
  };

  const run = async (work: () => Promise<ActionResult>, success?: string) => {
    setBusy(true);
    setError("");
    const result = await work();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    if (success) toast.success(success);
    router.refresh();
    return true;
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!isEmail(address)) {
      setError("That email address doesn't look right.");
      return;
    }
    if (await run(() => actions.invite(eventId, address), `Invited ${address} to co-host`)) setEmail("");
  };

  const copyLink = async () => {
    setBusy(true);
    setError("");
    const result = await actions.createLink(eventId);
    setBusy(false);
    if (result.error || !result.token) {
      setError(result.error ?? "The link wasn't made. Try again.");
      return;
    }
    const url = `${window.location.origin}/host-invite/${result.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Co-host link copied. It works for 14 days.");
    } catch {
      toast.message(`Copy this link: ${url}`);
    }
    router.refresh();
  };

  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-medium text-primary">Hosts</h2>
          <p className="text-sm text-tertiary">Co-hosts can edit the event, add guests, send invitations and reminders, see RSVPs and draw names.</p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {hosts.map((host) => (
            <li key={host.userId} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-primary">
                {host.name}
                {host.userId === viewerId ? " (you)" : ""}
                {host.isOwner && <span className="text-tertiary"> · made the event</span>}
              </span>
              {!host.isOwner && (viewerIsOwner || host.userId === viewerId) && (
                <RowActionsMenu
                  label={`More actions for ${host.userId === viewerId ? "you" : host.name}`}
                  disabled={busy}
                  actions={[
                    host.userId === viewerId
                      ? { id: "remove", label: "Leave this event", icon: LogOut, destructive: true }
                      : { id: "remove", label: "Remove co-host", icon: UserMinus, destructive: true },
                  ]}
                  onAction={() => {
                    setRemoveError("");
                    setRemoving({ userId: host.userId, name: host.name });
                  }}
                />
              )}
            </li>
          ))}
          {invites.map((pending) => (
            <li key={pending.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-tertiary">
                {pending.email ?? "Shared link"} · invited
              </span>
              <RowActionsMenu
                label={`More actions for the invitation${pending.email ? ` to ${pending.email}` : ""}`}
                disabled={busy}
                actions={[{ id: "revoke", label: "Cancel invitation", icon: X, destructive: true }]}
                onAction={() => run(() => actions.revoke(eventId, pending.id))}
              />
            </li>
          ))}
        </ul>
        <form onSubmit={invite} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Input
              label="Invite a co-host"
              type="email"
              value={email}
              onChange={(value) => {
                setEmail(value);
                setError("");
              }}
              placeholder="their@email.com"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-10 shrink-0"
            disabled={busy || !email.trim()}
            aria-label="Send co-host invitation"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          </Button>
        </form>
        <button
          type="button"
          onClick={copyLink}
          disabled={busy}
          className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm font-medium text-brand-600 hover:underline max-sm:min-h-11"
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Link2 aria-hidden="true" className="size-4" />}
          {copied ? "Copied" : "Copy a co-host link instead"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-error-primary">
            {error}
          </p>
        )}
      </CardContent>
      <ConfirmActionDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={leaving ? "Leave this event?" : `Remove ${removing?.name ?? ""} as a co-host?`}
        description={
          leaving
            ? "You'll stop seeing the event's guest list and RSVPs, and can't edit it. The owner can invite you again."
            : "They'll stop seeing the event's guest list and RSVPs, and can't edit it. You can invite them again."
        }
        confirmLabel={leaving ? "Leave" : "Remove"}
        working={busy}
        error={removeError}
        onConfirm={confirmRemove}
      />
    </Card>
  );
}
