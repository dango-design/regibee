import Link from "next/link";
import { Calendar, CookingPot, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileRegistryCard } from "@/components/profile-registry-card";
import { PandaMark } from "@/components/panda-mark";
import { GiftProfileCard } from "@/components/gift-profile-card";
import { ProfileAvatar } from "@/components/profile-avatar";
import { giftProfileAudienceSummary, hasGiftDetails, type GiftProfile } from "@/lib/gift-profile";
import { displayName as nameToShow } from "@/lib/profile-link";
import { eventHasPassed, eventTypeLabel } from "@/lib/events";
import type { SharedEvent } from "@/lib/shared-events";
import {
  isPastEvent,
  sortListedRegistries,
  type ListedRegistry,
} from "@/lib/registry-listing";

/** One event the viewer and this person both go to. The whole row opens it. */
function SharedEventCard({ event, today, basePath }: { event: SharedEvent; today: string; basePath: string }) {
  const Icon = event.eventType === "meal_train" ? CookingPot : PartyPopper;
  return (
    <Link
      href={`${basePath}${event.href}`}
      className="group clickable-card flex items-center gap-4 rounded-2xl border border-secondary bg-primary p-4 shadow-sm"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-solid/10">
        <Icon aria-hidden="true" className="h-5 w-5 text-brand-tertiary motion-safe:group-hover:animate-wiggle" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium text-primary">{event.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-tertiary">
          <span>{eventTypeLabel(event.eventType)}</span>
          {event.eventDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
              {/* With the year, like the registries above: past events can be years old. */}
              {`${new Date(event.eventDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}${event.time ? ` · ${event.time}` : ""}`}
            </span>
          )}
        </span>
      </span>
      {eventHasPassed({ event_date: event.eventDate }, today) && (
        <Badge variant="secondary" className="shrink-0">
          Past
        </Badge>
      )}
    </Link>
  );
}


export function PublicProfile({
  fullName,
  photoUrl,
  registries,
  sharedEvents = [],
  today,
  isOwnProfile = false,
  followAction,
  publicNote = null,
  giftProfile = {},
  showBirthday = false,
  basePath = "",
}: {
  fullName: string | null;
  /** The profile photo. Without one, the circle shows the name's initials. */
  photoUrl?: string | null;
  registries: ListedRegistry[];
  /**
   * Events the viewer and this person both went to or are going to, in the
   * order to show them (src/lib/shared-events.ts). Empty for a signed-out
   * viewer and on someone's own profile.
   */
  sharedEvents?: SharedEvent[];
  today: string;
  isOwnProfile?: boolean;
  followAction?: React.ReactNode;
  /** What the person wrote for everyone who opens their profile. */
  publicNote?: string | null;
  /**
   * The parts of the gift profile this viewer may see, by the person's
   * choices (visibleGiftProfile). On their own profile, it holds the choices
   * too, for the line that says who sees each part.
   */
  giftProfile?: GiftProfile;
  /** Shows the birthday too, when the viewer may see it. */
  showBirthday?: boolean;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
}) {
  const displayName = nameToShow({ full_name: fullName });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <ProfileAvatar name={displayName} photoUrl={photoUrl} className="size-20" fallbackClassName="text-2xl" />
        <div className="min-w-0 max-w-full">
          <h1 className="break-words text-2xl font-bold">{displayName}</h1>
          {publicNote && (
            <p className="mx-auto mt-2 max-w-md whitespace-pre-line break-words text-sm text-secondary">
              {publicNote}
            </p>
          )}
        </div>
        {isOwnProfile ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`${basePath}/dashboard/account`}>Edit profile</Link>
          </Button>
        ) : (
          followAction
        )}
      </div>

      {hasGiftDetails(giftProfile) || (showBirthday && giftProfile.birthday) ? (
        <GiftProfileCard
          className="mt-8"
          profile={giftProfile}
          name={displayName}
          showBirthday={showBirthday}
          caption={isOwnProfile && giftProfileAudienceSummary(giftProfile)}
          action={
            isOwnProfile && (
              <Link
                href={`${basePath}/dashboard/account#gift-profile`}
                className="text-sm font-medium text-brand-tertiary hover:underline"
              >
                Edit
              </Link>
            )
          }
        />
      ) : (
        isOwnProfile && (
          <p className="mt-8 rounded-2xl border border-dashed border-secondary px-4 py-3 text-center text-sm text-tertiary">
            Add your sizes, likes and birthday so the people you follow who follow you back know what to get
            you.{" "}
            <Link
              href={`${basePath}/dashboard/account#gift-profile`}
              className="font-medium text-brand-tertiary hover:underline"
            >
              Add a gift profile
            </Link>
          </p>
        )
      )}

      {registries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-secondary px-4 py-12 text-center">
          <PandaMark className="h-16 w-auto" />
          <p className="mt-3 text-tertiary">No registries to show yet.</p>
          {isOwnProfile && (
            <Link
              href={`${basePath}/dashboard/account#profile-registries`}
              className="mt-2 text-sm font-medium text-brand-tertiary hover:underline"
            >
              Choose which registries to show
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Registries</h2>
          <div className="mt-3 flex flex-col gap-3">
            {sortListedRegistries(registries, today).map((registry) => (
              <ProfileRegistryCard
                key={registry.slug}
                registry={registry}
                isPast={isPastEvent(registry, today)}
                basePath={basePath}
              />
            ))}
          </div>
        </div>
      )}

      {sharedEvents.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Events together</h2>
          <p className="mt-1 text-sm text-tertiary">
            Events you and {displayName} both went to or are going to. Only you see this.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {sharedEvents.map((event) => (
              <SharedEventCard key={event.id} event={event} today={today} basePath={basePath} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
