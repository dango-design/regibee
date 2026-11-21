import { createContext } from "react";

/**
 * The size of the select an item is in. It has its own file so select-item
 * doesn't import select.tsx, which imports select-item. With that loop, a file
 * that imported select-item first crashed on load.
 */
export const SelectContext = createContext<{ size: "sm" | "md" }>({ size: "sm" });
