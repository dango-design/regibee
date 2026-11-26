"use client";

import { ChevronDown } from "lucide-react";
import { Button, ListBox, Select, SelectValue } from "react-aria-components";
import { Popover } from "@/components/base/select/popover";
import { SelectItem } from "@/components/base/select/select-item";

/**
 * A small pill dropdown for filters and sorting. The pill is as wide as the
 * chosen label, and its menu is at least as wide as the pill.
 */
export function TightSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      value={value}
      onChange={(key) => key != null && onChange(String(key) as T)}
    >
      <Button className="relative inline-flex cursor-pointer items-center rounded-md border border-primary bg-primary py-1.5 pl-3 pr-8 text-sm outline-hidden focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand data-pressed:bg-primary_hover max-sm:min-h-11">
        <SelectValue className="whitespace-nowrap">{({ selectedText }) => selectedText}</SelectValue>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 h-4 w-4 text-tertiary" />
      </Button>
      <Popover size="sm" placement="bottom start" className="w-auto min-w-(--trigger-width)">
        <ListBox className="outline-hidden">
          {options.map((option) => (
            <SelectItem key={option.value} id={option.value} label={option.label} />
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
