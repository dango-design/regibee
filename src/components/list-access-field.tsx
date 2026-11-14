"use client";

import { LIST_ACCESS } from "@/lib/list-access";

/**
 * Who can open a list: only people with its link, or the public too. Sends
 * `isPublic` with its form, as "true" or "false".
 */
export function ListAccessField({
  isPublic,
  onChange,
}: {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
}) {
  const options = [
    { value: false, ...LIST_ACCESS.link },
    { value: true, ...LIST_ACCESS.public },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-secondary">Who can see it</legend>
      {options.map((option) => (
        <label key={option.label} className="flex items-start gap-2 max-sm:min-h-11">
          <input
            type="radio"
            name="isPublic"
            value={option.value ? "true" : "false"}
            checked={isPublic === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1"
          />
          <span className="min-w-0">
            <span className="block text-sm text-primary">{option.label}</span>
            <span className="block text-xs text-tertiary">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
