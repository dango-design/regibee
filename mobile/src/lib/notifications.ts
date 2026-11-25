// Push notifications on this phone: follow requests, RSVPs to your events and
// gifts on your lists. The website's server sends them through Expo's push
// service (src/lib/push-server.ts) to the tokens saved in push_tokens.
//
// - After sign-in, the app asks once for permission, gets this phone's Expo
//   push token and saves it for the account (register_push_token).
// - Signing out deletes the row, while the session can still delete it.
// - The switch on the Account tab turns them off for this phone: it deletes
//   the row and remembers the choice, so the next sign-in doesn't add it back.
//
// Pushes need a development or store build: Expo Go can't get a token. On
// Android they also need Firebase set up for the app (see mobile/README.md).

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

import { pushPath } from "@shared/push";

import { kvStorage } from "@/lib/kv-storage";
import { supabase } from "@/lib/supabase";

// Without a working push setup (no Apple push key yet, no Firebase on
// Android, or an unsigned simulator build), the token request can wait
// forever. Give up after this long.
const TOKEN_TIMEOUT_MS = 20_000;

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** "off" once the person turns notifications off on this phone. */
const CHOICE_KEY = "push-notifications";
/** The token saved for the signed-in account, so signing out can delete it. */
const TOKEN_KEY = "push-token";

export const PUSH_SUPPORTED = Platform.OS === "ios" || Platform.OS === "android";

if (PUSH_SUPPORTED) {
  // A push that arrives while the app is open still shows.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function turnedOff() {
  return (await kvStorage.getItem(CHOICE_KEY).catch(() => null)) === "off";
}

/**
 * Gets this phone's token and saves it for the signed-in account. `ask` shows
 * the system's permission prompt if it hasn't been answered yet. Returns
 * whether pushes are now on.
 */
async function register(ask: boolean): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;
  // Android 13 and later only show the permission prompt once a channel exists.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Regibee",
      importance: AndroidImportance.HIGH,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && ask && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return false;

  const projectId = (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
  const { data: token } = await withTimeout(
    Notifications.getExpoPushTokenAsync({ projectId }),
    TOKEN_TIMEOUT_MS,
    "Regibee couldn't set up notifications on this phone. Try again later."
  );
  const { error } = await supabase.rpc("register_push_token", { p_token: token, p_platform: Platform.OS });
  if (error) throw new Error(error.message);
  await kvStorage.setItem(TOKEN_KEY, token);
  return true;
}

/**
 * After sign-in, and each time the app starts signed in: saves this phone's
 * token unless the person turned notifications off here. Asks for permission
 * the first time. Never throws: without a token the app works as before.
 */
export async function registerAfterSignIn() {
  if (!PUSH_SUPPORTED || (await turnedOff())) return;
  try {
    await register(true);
  } catch (e) {
    // No Firebase set up (Android), no network, or the migration hasn't run.
    console.warn("[push] Couldn't turn on notifications:", e);
  }
}

/** Deletes this phone's row. Call it before signing out, while the session works. */
export async function forgetThisPhone() {
  const token = await kvStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  try {
    await supabase.from("push_tokens").delete().eq("token", token);
  } catch (e) {
    console.warn("[push] Couldn't remove this phone's token:", e);
  }
  await kvStorage.removeItem(TOKEN_KEY).catch(() => {});
}

/** The Account tab's switch. `on` is null until it's known. */
export function useNotificationsSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [off, permission, token] = await Promise.all([
        turnedOff(),
        Notifications.getPermissionsAsync(),
        kvStorage.getItem(TOKEN_KEY).catch(() => null),
      ]);
      if (active) setOn(!off && permission.granted && Boolean(token));
    })().catch(() => active && setOn(false));
    return () => {
      active = false;
    };
  }, []);

  async function change(next: boolean) {
    setBusy(true);
    setOn(next);
    try {
      if (!next) {
        await kvStorage.setItem(CHOICE_KEY, "off");
        await forgetThisPhone();
        return;
      }
      await kvStorage.removeItem(CHOICE_KEY);
      if (await register(true)) return;
      // Once someone says no, the system won't ask again. Only Settings can change it.
      setOn(false);
      Alert.alert("Notifications are off for Regibee", "To get them, allow notifications for Regibee in Settings.", [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ]);
    } catch (e) {
      setOn(!next);
      Alert.alert("That didn't work", e instanceof Error ? e.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return { on, busy, change };
}

/**
 * Opens the screen a tapped notification is about, once the person is
 * signed in. A tap that opened the app counts too.
 */
export function useOpenTappedNotification(signedIn: boolean) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!signedIn || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const path = pushPath(response.notification.request.content.data);
    // Each tap opens its screen once.
    Notifications.clearLastNotificationResponse();
    // The server only sends paths to the app's own screens.
    if (path) router.push(path as Href);
  }, [signedIn, response]);
}
