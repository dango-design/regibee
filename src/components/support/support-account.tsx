// One account on the support pages (/support/users/[userId]). See "Support
// view" in CLAUDE.md.

import { eventTypeLabel } from "@/lib/events";
import { NO_RECIPIENT_LABEL } from "@/lib/gift-ideas";
import { formatPrice } from "@/lib/money";
import { LIST_ACCESS, listVisibility } from "@/lib/list-access";
import { occasionLabel } from "@/lib/registry-copy";
import type { SupportAccount, SupportList } from "@/lib/support";
import {
  SupportFacts,
  SupportLinkRow,
  SupportPage,
  SupportRow,
  SupportRows,
  SupportSection,
  SupportTag,
  supportDate,
  supportDateTime,
} from "./support-parts";

const SIGN_IN_METHODS: Record<string, string> = { email: "Email and password", google: "Google", apple: "Apple" };

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function ListRows({ lists, empty }: { lists: SupportList[]; empty: string }) {
  return (
    <SupportRows empty={empty}>
      {lists.map((list) => (
        <SupportLinkRow key={list.id} href={`/support/lists/${list.id}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-primary">{list.title}</span>
            <SupportTag>{LIST_ACCESS[listVisibility({ is_public: list.isPublic, is_private: list.isPrivate })].short}</SupportTag>
          </div>
          <p className="text-tertiary">
            {occasionLabel(list.registryType, list.eventType)} · {count(list.itemCount, "item", "items")}
            {list.eventDate && ` · ${supportDate(list.eventDate)}`} · Made {supportDate(list.createdAt)}
          </p>
        </SupportLinkRow>
      ))}
    </SupportRows>
  );
}

export function SupportAccountView({ account }: { account: SupportAccount }) {
  return (
    <SupportPage back={{ href: "/support", label: "Support search" }}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-display-xs font-semibold text-primary">{account.name || "No name"}</h1>
        {!account.confirmed && <SupportTag tone="warning">Email not confirmed</SupportTag>}
      </div>
      <p className="mt-1 text-sm text-tertiary">{account.email ?? "No email"}</p>

      <SupportSection title="Account">
        <SupportFacts
          facts={[
            { label: "Joined", value: supportDateTime(account.createdAt) },
            { label: "Last signed in", value: supportDateTime(account.lastSignInAt) },
            {
              label: "Signs in with",
              value: account.signInMethods.map((m) => SIGN_IN_METHODS[m] ?? m).join(", ") || "—",
            },
            { label: "Account level", value: account.level === "star" ? "Star" : "Basic" },
            {
              label: "Emails to typed-in addresses, last 24 hours",
              value: `${account.emailsToday.sent} of ${account.emailsToday.limit}`,
            },
            {
              label: "Profile",
              value: account.profilePath ? (
                <a href={account.profilePath} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {account.profilePath}
                </a>
              ) : (
                "No profile"
              ),
            },
          ]}
        />
      </SupportSection>

      <SupportSection title="Their lists" count={account.ownedLists.length}>
        <ListRows lists={account.ownedLists} empty="No lists yet." />
      </SupportSection>

      {account.managedLists.length > 0 && (
        <SupportSection title="Lists they help manage" count={account.managedLists.length}>
          <ListRows lists={account.managedLists} empty="" />
        </SupportSection>
      )}

      <SupportSection title="Events they host" count={account.events.length}>
        <SupportRows empty="No events.">
          {account.events.map((event) => (
            <SupportRow key={event.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-primary">{event.title}</span>
                {!event.owns && <SupportTag>Co-host</SupportTag>}
              </div>
              <p className="text-tertiary">
                {eventTypeLabel(event.eventType)} · {supportDate(event.eventDate)} ·{" "}
                {count(event.guestCount, "guest", "guests")}
              </p>
            </SupportRow>
          ))}
        </SupportRows>
      </SupportSection>

      <SupportSection title="Gift ideas" count={account.giftIdeas.length}>
        <SupportRows empty="No gift ideas.">
          {account.giftIdeas.map((idea) => (
            <SupportRow key={idea.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-primary">{idea.title}</span>
                {idea.boughtAt && <SupportTag tone="success">Bought</SupportTag>}
              </div>
              <p className="text-tertiary">
                {idea.recipient ? <>For {idea.recipient}</> : NO_RECIPIENT_LABEL}
                {idea.price !== null && ` · ${formatPrice(idea.price)}`} · Saved {supportDate(idea.createdAt)}
                {idea.externalUrl && (
                  <>
                    {" · "}
                    <a href={idea.externalUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      Link
                    </a>
                  </>
                )}
              </p>
            </SupportRow>
          ))}
        </SupportRows>
      </SupportSection>
    </SupportPage>
  );
}
