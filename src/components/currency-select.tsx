"use client";

import { ChevronDown } from "@untitledui/icons";
import { Button, ListBox, Select, SelectValue } from "react-aria-components";
import { InputPrefix } from "@/components/base/input/input-group";
import { Popover } from "@/components/base/select/popover";
import { SelectItem } from "@/components/base/select/select-item";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];

/**
 * The currency menu at the end of a price field. Pass it as an InputGroup's
 * `trailingAddon`. With `name`, the form sends the currency too.
 */
export function CurrencySelect({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <InputPrefix position="trailing">
      <Select
        aria-label="Currency"
        name={name}
        value={value}
        onChange={(key) => key != null && onChange(String(key))}
        className="flex"
      >
        {/* The negative margins stretch the button over the whole addon, so a
            tap anywhere on it opens the menu. */}
        <Button className="-mx-3 -my-2 flex cursor-pointer items-center gap-1 rounded-r-lg px-3 py-2 text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset max-sm:-my-2.5 max-sm:py-2.5">
          <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
          <ChevronDown aria-hidden="true" className="size-4 text-fg-quaternary" />
        </Button>
        <Popover size="sm" placement="bottom end" className="w-auto min-w-28">
          <ListBox className="outline-hidden">
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency} id={currency} label={currency} />
            ))}
          </ListBox>
        </Popover>
      </Select>
    </InputPrefix>
  );
}
