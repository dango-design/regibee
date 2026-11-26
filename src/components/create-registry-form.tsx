"use client";

import { useRef, useState, type ReactNode } from "react";
import { Baby, Gift, Globe, Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { ProfileListingField } from "@/components/profile-listing-field";
import {
  ChoiceCard,
  ChoiceChip,
  StepFooter,
  StepSection,
  formatStepDate,
  isFinishedDate,
  useStepSections,
  type StepInfo,
  type StepNav,
} from "@/components/step-sections";
import { createRegistry } from "@/lib/actions/registry";
import {
  DEFAULT_LIST_VISIBILITY,
  LIST_ACCESS,
  LIST_VISIBILITIES,
  PROFILE_AUDIENCE,
  clampProfileAudience,
  defaultProfileAudience,
  type ListVisibility,
  type ProfileAudience,
} from "@/lib/list-access";
import { REGISTRY_OCCASION_CHOICES, copyFor } from "@/lib/registry-copy";
import type { PersonalEventType, RegistryType } from "@/lib/types";

// The form is a stack of sections, like a checkout page (step-sections.tsx).
// One section is open at a time. Finishing a section closes it and opens the
// next one the person hasn't been to yet. Only the type and the name are
// required, so Create works as soon as there is a name. Every field stays in
// the form while its section is closed, so closed sections still submit their
// values.
//
// The phone app's new registry screen (mobile/src/app/new-registry.tsx) asks
// the same things in the same words, with the same defaults. Change both
// together.

type SectionId = "type" | "details" | "privacy" | "welcome" | "payments";

const SECTION_ORDER: SectionId[] = ["type", "details", "privacy", "welcome", "payments"];

const VISIBILITY_ICONS: Record<ListVisibility, typeof Lock> = {
  private: Lock,
  link: Link2,
  public: Globe,
};

export interface CreateRegistryFormProps {
  /**
   * False for guests (anonymous sessions), who have no profile page, so the
   * "Who sees it on your profile" choice is left out.
   */
  canListOnProfile?: boolean;
  /**
   * The registry type, already chosen on the New page. With one, the form
   * opens on the name, or on the occasion for a personal list without one.
   */
  startType?: RegistryType;
  /** A personal list's occasion, already chosen on the New page. */
  startOccasion?: PersonalEventType;
  createAction?: (formData: FormData) => Promise<{ error?: string } | void>;
}

/** Which section opens first, and which count as visited already. */
function startingNav(startType?: RegistryType, startOccasion?: PersonalEventType): StepNav<SectionId> {
  const typeIsSettled = startType === "baby" || (startType === "personal" && Boolean(startOccasion));
  return typeIsSettled
    ? { open: "details", visited: new Set<SectionId>(["type"]) }
    : { open: "type", visited: new Set<SectionId>() };
}

export function CreateRegistryForm({
  canListOnProfile = true,
  startType,
  startOccasion,
  createAction = createRegistry,
}: CreateRegistryFormProps) {
  const [registryType, setRegistryType] = useState<RegistryType>(startType ?? "baby");
  const [eventType, setEventType] = useState<PersonalEventType | null>(
    startType === "personal" ? (startOccasion ?? null) : null,
  );
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [visibility, setVisibility] = useState<ListVisibility>(DEFAULT_LIST_VISIBILITY);
  const [audienceChoice, setAudienceChoice] = useState<ProfileAudience | null>(null);
  const [description, setDescription] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [venmo, setVenmo] = useState("");
  const [paypal, setPaypal] = useState("");
  const [zelle, setZelle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Personal registries are shown on the profile by default. Baby registries
  // aren't, because showing one could announce a pregnancy.
  const audience = clampProfileAudience(
    audienceChoice ?? (registryType === "personal" ? defaultProfileAudience(visibility) : "hidden"),
    visibility,
  );

  const copy = copyFor({
    registryType,
    eventType: registryType === "personal" ? eventType : null,
  });

  const hasWelcome = Boolean(description.trim());
  const hasZip = Boolean(zipCode.trim());
  const paymentNames = [
    venmo.trim() && "Venmo",
    paypal.trim() && "PayPal",
    zelle.trim() && "Zelle",
  ].filter(Boolean) as string[];

  const sections: Record<SectionId, StepInfo> = {
    type: { complete: true, optional: false, hasContent: true },
    details: { complete: Boolean(title.trim()), optional: false, hasContent: Boolean(title.trim()) },
    privacy: { complete: true, optional: false, hasContent: true },
    welcome: { complete: true, optional: true, hasContent: hasWelcome },
    payments: { complete: true, optional: true, hasContent: paymentNames.length > 0 || hasZip },
  };

  const { nav, move, advanceSoon, cancelAdvance, finish, footerLabel, sectionProps, createRef } = useStepSections({
    order: SECTION_ORDER,
    start: () => startingNav(startType, startOccasion),
    steps: sections,
    canFinish: (id) => {
      if (id === "details" && !title.trim()) {
        setTitleError(true);
        titleRef.current?.focus();
        return false;
      }
      return true;
    },
  });

  const chooseRegistryType = (type: RegistryType) => {
    if (type === "baby" || registryType === "personal") {
      // Baby has nothing more to pick. Clicking Personal again means the
      // person is happy with the occasion they already have.
      advanceSoon("type");
    } else {
      cancelAdvance();
    }
    if (type !== registryType) {
      setRegistryType(type);
      setAudienceChoice(null);
    }
  };

  const chooseOccasion = (value: PersonalEventType | null) => {
    setEventType(value);
    advanceSoon("type");
  };

  const changeEventDate = (value: string) => {
    setEventDate(value);
    cancelAdvance();
    if (!isFinishedDate(value)) return;
    if (title.trim()) {
      advanceSoon("details", 500);
    } else {
      titleRef.current?.focus();
    }
  };

  const chooseVisibility = (value: ListVisibility) => {
    setVisibility(value);
    // Without a profile, or for a private list, which can't be on one,
    // visibility is the only choice in this section.
    if (!canListOnProfile || value === "private") advanceSoon("privacy");
  };

  // The zip code is the last field in the payments section, so a full zip
  // code finishes the section.
  const changeZipCode = (value: string) => {
    setZipCode(value);
    cancelAdvance();
    if (/^\d{5}$/.test(value.trim())) advanceSoon("payments");
  };

  const handleSubmit = async (formData: FormData) => {
    if (!title.trim()) {
      setTitleError(true);
      if (nav.open === "details") {
        titleRef.current?.focus();
      } else {
        move({ type: "open", id: "details" });
      }
      return;
    }
    setLoading(true);
    setError("");
    const result = await createAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const occasion = REGISTRY_OCCASION_CHOICES.find((option) => option.value === eventType);
  const privacySummary = [
    LIST_ACCESS[visibility].short,
    canListOnProfile && visibility !== "private" ? PROFILE_AUDIENCE[audience].short : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const summaries: Record<SectionId, ReactNode> = {
    type: registryType === "baby" ? "A baby" : occasion?.label,
    details: sections.details.complete ? (
      [title.trim(), eventDate ? formatStepDate(eventDate) : null].filter(Boolean).join(" · ")
    ) : (
      <span className="text-error-primary">Needs a name</span>
    ),
    privacy: privacySummary,
    welcome: hasWelcome ? description.trim() : "Skipped",
    payments:
      [
        paymentNames.length > 0 ? paymentNames.join(", ") : null,
        hasZip ? `Sales tax for ${zipCode.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Skipped",
  };

  const Icon = registryType === "baby" ? Baby : Gift;

  return (
    <div className="container mx-auto max-w-xl px-4 py-8">
      {/* onSubmit, not action: React resets a form after its action runs, which
          would clear every field if creating the registry fails. noValidate,
          because the browser can't point at a required field in a closed
          section. handleSubmit checks the name instead. */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="registryType" value={registryType} />
        {registryType === "personal" && <input type="hidden" name="eventType" value={eventType ?? ""} />}
        <input type="hidden" name="visibility" value={visibility} />
        {/* The zip code is only used for tax estimates, so entering one turns them on. */}
        <input type="hidden" name="taxEnabled" value={hasZip ? "true" : "false"} />

        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-solid/10">
            <Icon className="h-6 w-6 text-brand-tertiary" />
          </div>
          <h1 className="text-2xl font-medium text-primary">New registry</h1>
        </div>

        <div className="space-y-3">
          <StepSection title="What's it for?" {...sectionProps("type", summaries.type)}>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceCard
                selected={registryType === "baby"}
                onClick={() => chooseRegistryType("baby")}
                icon={<Baby className="h-4 w-4" />}
                title="A baby"
              />
              <ChoiceCard
                selected={registryType === "personal"}
                onClick={() => chooseRegistryType("personal")}
                icon={<Gift className="h-4 w-4" />}
                title="Something else"
              />
            </div>

            {registryType === "personal" && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-secondary">What&apos;s the occasion?</p>
                <div className="flex flex-wrap gap-2">
                  {REGISTRY_OCCASION_CHOICES.map((option) => (
                    <ChoiceChip
                      key={option.value ?? "none"}
                      selected={eventType === option.value}
                      onClick={() => chooseOccasion(option.value)}
                      label={option.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </StepSection>

          <StepSection title="Name and date" {...sectionProps("details", summaries.details)}>
            <div className="space-y-4">
              <Input
                ref={titleRef}
                label="Registry name"
                name="title"
                placeholder={copy.titlePlaceholder}
                isRequired
                value={title}
                onChange={(value) => {
                  setTitle(value);
                  if (value.trim()) setTitleError(false);
                }}
                isInvalid={titleError}
                hint={titleError ? "Give your registry a name." : undefined}
              />
              <Input
                label={`${copy.eventDateLabel} (optional)`}
                name="eventDate"
                type="date"
                value={eventDate}
                onChange={changeEventDate}
              />
            </div>
            <StepFooter label={footerLabel("details")} onClick={() => finish("details")} enterHint />
          </StepSection>

          {/* Privacy shows the defaults the person gets if they skip it. */}
          <StepSection title="Who can open it" {...sectionProps("privacy", summaries.privacy, { showWhenUpcoming: true })}>
            <div className="grid gap-2 sm:grid-cols-3">
              {LIST_VISIBILITIES.map((value) => {
                const VisibilityIcon = VISIBILITY_ICONS[value];
                return (
                  <ChoiceCard
                    key={value}
                    selected={visibility === value}
                    onClick={() => chooseVisibility(value)}
                    icon={<VisibilityIcon className="h-4 w-4" />}
                    title={LIST_ACCESS[value].label}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-sm text-tertiary">{LIST_ACCESS[visibility].description}</p>
            {canListOnProfile && (
              <div className="mt-4">
                <ProfileListingField
                  visibility={visibility}
                  audience={audience}
                  onChange={setAudienceChoice}
                />
              </div>
            )}
            <StepFooter label={footerLabel("privacy")} onClick={() => finish("privacy")} />
          </StepSection>

          <StepSection title="Welcome message" {...sectionProps("welcome", summaries.welcome)}>
            <TextArea
              label="Message to guests"
              name="description"
              placeholder="Say hello to the people visiting your registry"
              rows={4}
              value={description}
              onChange={setDescription}
            />
            <StepFooter
              label={footerLabel("welcome")}
              onClick={() => finish("welcome")}
              primary={hasWelcome}
            />
          </StepSection>

          <StepSection title="Payments and sales tax" {...sectionProps("payments", summaries.payments)}>
            <p className="mb-3 text-sm text-tertiary">
              Gift givers pay you directly. Regibee never handles money.
            </p>
            <div className="space-y-4">
              <Input
                label="Venmo"
                name="venmo"
                placeholder="@your-venmo"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                value={venmo}
                onChange={setVenmo}
              />
              <Input
                label="PayPal"
                name="paypal"
                placeholder="you@email.com or PayPal.me link"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                value={paypal}
                onChange={setPaypal}
              />
              <Input
                label="Zelle"
                name="zelle"
                placeholder="you@email.com or phone number"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                value={zelle}
                onChange={setZelle}
              />
              <Input
                label="Zip code"
                name="zipCode"
                placeholder="12345"
                inputMode="numeric"
                autoComplete="postal-code"
                value={zipCode}
                onChange={changeZipCode}
                hint="Used to estimate sales tax."
              />
            </div>
            <StepFooter
              label={footerLabel("payments")}
              onClick={() => finish("payments")}
              primary={sections.payments.hasContent}
              enterHint={sections.payments.hasContent}
            />
          </StepSection>
        </div>

        <div ref={createRef} className="mt-6 space-y-3">
          {error && <p className="text-sm text-error-primary">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create registry"}
          </Button>
        </div>
      </form>
    </div>
  );
}
