"use client";

// The support team's search page (/support). See "Support view" in CLAUDE.md.
// A client component because the search field takes its icon as a component,
// which a server component can't hand to it.

import { Search } from "lucide-react";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/ui/button";
import { LIST_ACCESS, listVisibility } from "@/lib/list-access";
import type { SupportSearchResults } from "@/lib/support";
import { SupportLinkRow, SupportPage, SupportRows, SupportSection, SupportTag, supportDate } from "./support-parts";

export function SupportSearch({ query, results }: { query: string; results: SupportSearchResults | null }) {
  const nothing = results && results.accounts.length === 0 && results.lists.length === 0;
  return (
    <SupportPage recorded={false}>
      <h1 className="font-display text-display-xs font-semibold text-primary">Find an account or list</h1>
      <p className="mt-1 text-sm text-tertiary">
        Search by email, name or list title, or paste a list&apos;s or profile&apos;s link. Each account or list you
        open is recorded.
      </p>

      {/* A plain form: searching works before the page's scripts load. */}
      <form action="/support" method="get" role="search" className="mt-6 flex items-end gap-2">
        <Input
          name="q"
          label="Search"
          placeholder="Email, name, list title or link"
          type="search"
          icon={Search}
          defaultValue={query}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className="min-w-0 flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      {nothing && <p className="mt-8 text-sm text-tertiary">No accounts or lists match &ldquo;{query}&rdquo;.</p>}

      {results && results.accounts.length > 0 && (
        <SupportSection title="Accounts" count={results.accounts.length}>
          <SupportRows empty="">
            {results.accounts.map((account) => (
              <SupportLinkRow key={account.id} href={`/support/users/${account.id}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-primary">{account.name || "No name"}</span>
                  {!account.confirmed && <SupportTag tone="warning">Email not confirmed</SupportTag>}
                </div>
                <p className="text-tertiary">
                  {account.email ?? "No email"} · Joined {supportDate(account.createdAt)}
                </p>
              </SupportLinkRow>
            ))}
          </SupportRows>
        </SupportSection>
      )}

      {results && results.lists.length > 0 && (
        <SupportSection title="Lists" count={results.lists.length}>
          <SupportRows empty="">
            {results.lists.map((list) => (
              <SupportLinkRow key={list.id} href={`/support/lists/${list.id}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-primary">{list.title}</span>
                  <SupportTag>{LIST_ACCESS[listVisibility({ is_public: list.isPublic, is_private: list.isPrivate })].short}</SupportTag>
                </div>
                <p className="text-tertiary">
                  {list.ownerName || "No name"} · Made {supportDate(list.createdAt)}
                </p>
              </SupportLinkRow>
            ))}
          </SupportRows>
        </SupportSection>
      )}
    </SupportPage>
  );
}
