"use client";

import { useEffect } from "react";

// After a form that ends far down the page, like the new registry form, the
// next page can open partway down: Next.js only scrolls to the top when the new
// page's top edge is off screen, and the sticky top bar then covers the
// page's heading. The form calls arriveAtTop() just before it sends, and the
// page it leads to renders <ArriveAtTop />, which scrolls to the top once.

const KEY = "regibee:arrive-at-top";

/** Asks the next page that renders <ArriveAtTop /> to open at the top. */
export function arriveAtTop() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Private browsing can refuse storage. The page then opens where it opens.
  }
}

/** Takes the request back, when the form didn't lead anywhere. */
export function cancelArriveAtTop() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was saved.
  }
}

export function ArriveAtTop() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) !== "1") return;
      sessionStorage.removeItem(KEY);
    } catch {
      return;
    }
    window.scrollTo({ top: 0 });
  }, []);
  return null;
}
