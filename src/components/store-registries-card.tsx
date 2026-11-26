"use client";

import { useState } from "react";
import { Info, Link as LinkIcon, Package, Percent, RotateCcw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { Input } from "@/components/base/input/input";
import { SelectField } from "@/components/base/select/select-field";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { SECTION_SCROLL_MARGIN, SectionTitle } from "@/components/section-nav";
import { updateRetailerRegistries } from "@/lib/actions/registry";
import {
  getStore,
  isLinkForStore,
  isStoreId,
  STORES,
  type RetailerRegistry,
  type StoreId,
} from "@/lib/retailers";

type SaveAction = (
  registryId: string,
  registries: RetailerRegistry[]
) => Promise<{ error?: string; registries?: RetailerRegistry[] } | undefined>;

interface StoreRegistriesCardProps {
  registryId: string;
  initialRegistries: RetailerRegistry[];
  /** Stories pass a stand-in so nothing is saved. */
  saveAction?: SaveAction;
}

const PERKS = [
  { icon: Percent, label: "Completion discount" },
  { icon: RotateCcw, label: "Longer returns" },
  { icon: Package, label: "Welcome box" },
];

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

export function StoreRegistriesCard({
  registryId,
  initialRegistries,
  saveAction = updateRetailerRegistries,
}: StoreRegistriesCardProps) {
  const [registries, setRegistries] = useState<RetailerRegistry[]>(initialRegistries);
  const [store, setStore] = useState<StoreId | "">("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // The store registry waiting for the owner to confirm its removal.
  const [removing, setRemoving] = useState<StoreId | null>(null);

  const unlinkedStores = STORES.filter((s) => !registries.some((r) => r.store === s.id));

  const save = async (next: RetailerRegistry[]) => {
    setSaving(true);
    setError("");
    const result = await saveAction(registryId, next);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return false;
    }
    setRegistries(result?.registries ?? next);
    return true;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) {
      setError("Choose a store.");
      return;
    }
    const trimmed = url.trim();
    const name = getStore(store).name;
    if (!trimmed) {
      setError(`Paste the link to your ${name} registry.`);
      return;
    }
    const full = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!isLinkForStore(full, store)) {
      setError(`That doesn't look like a ${name} link.`);
      return;
    }
    if (await save([...registries, { store, url: full }])) {
      setStore("");
      setUrl("");
    }
  };

  // An error shows under the list, like an error from adding one.
  const handleRemove = async () => {
    if (!removing) return;
    await save(registries.filter((r) => r.store !== removing));
    setRemoving(null);
  };

  return (
    // A section of the registry's settings page. The add-item dialog and the
    // store perks card link to it as #store-registries.
    <Card id="store-registries" className={SECTION_SCROLL_MARGIN}>
      <CardHeader>
        <SectionTitle sectionId="store-registries">Your store registries</SectionTitle>
        <CardDescription>
          Link your registry at Amazon, Target or another store, so guests&apos; gifts count toward its perks.
        </CardDescription>
        <ul className="flex flex-wrap gap-2 pt-2" aria-label="Perks stores may offer">
          {PERKS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 dark:border-brand-800 bg-brand-primary px-2.5 py-1 text-xs font-medium text-brand-secondary"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </CardHeader>
      <CardContent className="space-y-5">
        {registries.length > 0 && (
          <ul className="divide-y divide-secondary rounded-xl border border-secondary">
            {registries.map((r) => {
              const s = getStore(r.store);
              return (
                <li key={r.store} className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    aria-hidden="true"
                    className="font-display inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary"
                  >
                    {s.name.charAt(0)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-primary">{s.name}</span>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-tertiary hover:underline"
                    >
                      {displayUrl(r.url)}
                    </a>
                  </div>
                  {/* Removing is rare, so it's in a "…" menu, not a button on every row. */}
                  <RowActionsMenu
                    label={`More actions for ${s.name} registry`}
                    actions={[{ id: "remove", label: "Remove", icon: Unlink, destructive: true }]}
                    disabled={saving}
                    onAction={() => setRemoving(r.store)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {unlinkedStores.length > 0 && (
          <form onSubmit={handleAdd} className="space-y-2" noValidate>
            <p className="text-sm font-semibold text-primary">Add a store registry</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SelectField
                label="Store"
                value={store}
                onChange={(v) => {
                  setStore(isStoreId(v) ? v : "");
                  setError("");
                }}
                placeholder="Choose store"
                options={unlinkedStores.map((s) => ({ value: s.id, label: s.name }))}
                className="sm:w-48 sm:shrink-0"
              />
              <Input
                label="Registry link"
                // Plain text: links pasted without https:// are fine, but a
                // url field would mark them invalid.
                type="text"
                inputMode="url"
                placeholder="Paste the link to your registry"
                value={url}
                onChange={(v) => {
                  setUrl(v);
                  setError("");
                }}
                className="min-w-0 flex-1"
              />
              <Button type="submit" disabled={saving} className="h-10 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <LinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {saving ? "Saving…" : "Link"}
                </span>
              </Button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-error-primary">{error}</p>}

        <ConfirmActionDialog
          open={removing !== null}
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Remove your ${removing ? getStore(removing).name : ""} registry?`}
          description="Its link comes off this list. Your registry at the store stays as it is, and you can link it again later."
          confirmLabel="Remove"
          working={saving}
          onConfirm={handleRemove}
        />

        <p className="flex items-start gap-1.5 text-xs text-tertiary">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Guests don&apos;t see these links.
        </p>
      </CardContent>
    </Card>
  );
}
