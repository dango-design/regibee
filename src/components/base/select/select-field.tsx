"use client";

import { Select } from "./select";

// List keys can't be "", so the "" option gets this key instead.
const EMPTY_KEY = "__empty__";

export type SelectFieldOption = { value: string; label: string; disabled?: boolean };

interface SelectFieldProps {
    /** Shown above the field. Without it, pass `aria-label`. */
    label?: string;
    "aria-label"?: string;
    hint?: string;
    value: string;
    onChange: (value: string) => void;
    /**
     * An option whose value is "" lets people go back to nothing chosen. Its
     * label is also the placeholder, unless `placeholder` is set.
     */
    options: SelectFieldOption[];
    /** Shown while nothing is chosen. It isn't in the list. */
    placeholder?: string;
    disabled?: boolean;
    /** Sends the value with a form, through a hidden select. */
    name?: string;
    className?: string;
}

/**
 * A dropdown that opens our own styled list instead of the browser's menu.
 * The value is a string, and "" means nothing is chosen.
 */
export const SelectField = ({
    label,
    "aria-label": ariaLabel,
    hint,
    value,
    onChange,
    options,
    placeholder,
    disabled,
    name,
    className,
}: SelectFieldProps) => {
    const empty = options.find((option) => option.value === "");
    const items = options.map((option) => ({
        id: option.value === "" ? EMPTY_KEY : option.value,
        label: option.label,
        isDisabled: option.disabled,
    }));

    return (
        <Select
            label={label}
            aria-label={label ? undefined : ariaLabel}
            hint={hint}
            placeholder={placeholder ?? empty?.label ?? "Choose…"}
            // With nothing chosen, show the placeholder rather than the "" option.
            value={value === "" ? null : value}
            onChange={(key) => onChange(key == null || key === EMPTY_KEY ? "" : String(key))}
            items={items}
            isDisabled={disabled}
            name={name}
            className={className}
        >
            {(item) => <Select.Item id={item.id} label={item.label} isDisabled={item.isDisabled} />}
        </Select>
    );
};
