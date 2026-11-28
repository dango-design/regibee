// How a Regibee page talks to the browser extension. Browser only.
//
// The extension's content script (extension/src/content/connect.ts) runs on
// every Regibee page. The page and the script send each other messages with
// window.postMessage, and both check that a message came from the page's own
// window and origin.

import {
  isExtensionMessage,
  PAGE_SOURCE,
  type ExtensionFeature,
  type ExtensionMessage,
  type PageMessage,
} from "@/lib/extension";

// The extension answers a hello straight away when it's installed.
const HELLO_TIMEOUT_MS = 500;

type WithoutSource<T> = T extends unknown ? Omit<T, "source"> : never;

export function sendToExtension(message: WithoutSource<PageMessage>) {
  window.postMessage({ source: PAGE_SOURCE, ...message }, location.origin);
}

/** The first answer from the extension that `match` picks, or null when time runs out. */
export function waitForExtension<T>(match: (message: ExtensionMessage) => T | undefined, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      // Only the extension's content script on this page, never another frame or site.
      if (event.source !== window || event.origin !== location.origin) return;
      if (!isExtensionMessage(event.data)) return;
      const result = match(event.data);
      if (result === undefined) return;
      done();
      resolve(result);
    };
    const timer = setTimeout(() => {
      done();
      resolve(null);
    }, timeoutMs);
    function done() {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/** What the installed extension can do for the site, or null when it isn't installed. */
export function extensionFeatures(): Promise<ExtensionFeature[] | null> {
  const answer = waitForExtension((m) => (m.type === "ready" ? (m.features ?? []) : undefined), HELLO_TIMEOUT_MS);
  sendToExtension({ type: "hello" });
  return answer;
}
