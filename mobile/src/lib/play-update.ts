// Whether Google Play has a newer build of the app than the one on this phone,
// and a way to install it from inside the app.
//
// Most changes reach the app over the air (expo-updates, see version-section.tsx).
// A change to native code can't: it comes as a new build through Play, and an
// over-the-air update made after it only reaches phones that have that build.
// Play installs new builds by itself, but only when the phone is idle, which
// can take a day. Until then the app would just look out of date. So the app
// asks Play, through Play's in-app updates API (expo-in-app-updates), and
// offers to install the new build.
//
// Android only. Play only answers for a copy installed from Play: a preview
// build installed from an EAS link gets an error, which the Account tab shows.

import * as Application from "expo-application";
import * as InAppUpdates from "expo-in-app-updates";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Linking, Platform } from "react-native";

import { kvStorage } from "@/lib/kv-storage";

export const checksPlay = Platform.OS === "android" && !__DEV__;

export type PlayUpdateState = {
  checking: boolean;
  /** Play has a newer build. Its version code, when Play says. */
  available: { versionCode: string | null; immediate: boolean } | null;
  checkedAt: Date | null;
  error: string | null;
  /** Play's update screen is open, or a flexible update is downloading. */
  installing: boolean;
  /** The version code someone answered "Not now" for. */
  dismissed: string | null;
};

let state: PlayUpdateState = {
  checking: false,
  available: null,
  checkedAt: null,
  error: null,
  installing: false,
  dismissed: null,
};
const listeners = new Set<() => void>();

function set(change: Partial<PlayUpdateState>) {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const DISMISSED_KEY = "play-update-dismissed";
// Checking again when the app comes back to the front, at most this often.
const RECHECK_MS = 10 * 60 * 1000;

let inFlight: Promise<void> | null = null;

/** Asks Play whether a newer build is out. */
export function checkPlay(): Promise<void> {
  if (!checksPlay) return Promise.resolve();
  inFlight ??= (async () => {
    set({ checking: true });
    try {
      const result = await InAppUpdates.checkForUpdate();
      set({
        available: result.updateAvailable
          ? { versionCode: result.storeVersion ?? null, immediate: result.immediateAllowed === true || result.updateInProgress === true }
          : null,
        error: null,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ checking: false, checkedAt: new Date() });
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Opens Play's own screen to download and install the new build. Play restarts
 * the app when it's done. If Play's screen won't open, opens the app's page in
 * the Play Store instead, which has an Update button. Returns false then.
 */
export async function installPlayUpdate(): Promise<boolean> {
  set({ error: null });
  try {
    // Someone who tapped Update wants it now: Play's full-screen update, which
    // installs and restarts straight away. If Play doesn't allow that, its
    // smaller flow downloads in the background, then installs and restarts.
    const started = await InAppUpdates.startUpdate(state.available?.immediate ? true : undefined);
    if (!started) await checkPlay();
    return started;
  } catch (e) {
    set({ installing: false, error: e instanceof Error ? e.message : String(e) });
    Linking.openURL(`https://play.google.com/store/apps/details?id=${Application.applicationId}`).catch(() => {});
    return false;
  }
}

/** Hides the banner until Play has a build newer than this one. */
export function dismissPlayUpdate() {
  const versionCode = state.available?.versionCode;
  if (!versionCode) return;
  set({ dismissed: versionCode });
  kvStorage.setItem(DISMISSED_KEY, versionCode).catch(() => {});
}

export function usePlayUpdate(): PlayUpdateState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Whether to show the banner: Play has a newer build nobody said "Not now" to. */
export function usePlayUpdateBanner() {
  const play = usePlayUpdate();
  return play.available && play.available.versionCode !== play.dismissed ? play : null;
}

/** Checks when the app opens and when it comes back to the front. Call once, in the root layout. */
export function usePlayUpdateChecks() {
  useEffect(() => {
    if (!checksPlay) return;
    kvStorage
      .getItem(DISMISSED_KEY)
      .then((dismissed) => set({ dismissed }))
      .catch(() => {});
    checkPlay();
    const removeListeners = [
      InAppUpdates.addUpdateListener("updateStart", () => set({ installing: true })),
      InAppUpdates.addUpdateListener("updateCancelled", () => set({ installing: false })),
    ];
    const appState = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const last = state.checkedAt?.getTime() ?? 0;
      if (Date.now() - last > RECHECK_MS) checkPlay();
    });
    return () => {
      removeListeners.forEach((remove) => remove());
      appState.remove();
    };
  }, []);
}
