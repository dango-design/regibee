import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque/800ExtraBold";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { useAnalyticsAccount, useScreenViews } from "@/lib/analytics";
import { AuthProvider, useSession } from "@/lib/auth";
import { useOpenTappedNotification } from "@/lib/notifications";
import { usePlayUpdateChecks } from "@/lib/play-update";
import { QueryProvider } from "@/lib/query";
import { fonts, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  return (
    // Shares are cleared once the owner saves or cancels them, not when the app
    // goes to the background, so a share isn't lost while they sign in.
    <ShareIntentProvider options={{ resetOnBackground: false, disabled: Platform.OS === "web" }}>
      {/* Lets KeyboardAwareScrollView keep the field being typed in above the
          keyboard. Android doesn't shrink an edge-to-edge app for it. */}
      <KeyboardProvider>
        <QueryProvider>
          <AuthProvider>
            <RootNavigator ready={fontsLoaded || Boolean(fontError)} />
          </AuthProvider>
        </QueryProvider>
      </KeyboardProvider>
    </ShareIntentProvider>
  );
}

function RootNavigator({ ready }: { ready: boolean }) {
  const { session, demo, isReady } = useSession();
  const theme = useTheme();
  const signedIn = Boolean(session) || demo;
  useScreenViews();
  useAnalyticsAccount(session?.user.id ?? null);
  // Waits for the navigator below to be on screen.
  useOpenTappedNotification(Boolean(session) && ready && isReady);
  // Asks Google Play whether a newer build is out (Android only).
  usePlayUpdateChecks();

  useEffect(() => {
    if (ready && isReady) SplashScreen.hideAsync();
  }, [ready, isReady]);

  if (!ready || !isReady) return null;

  const base = theme.dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.tint,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <ShareRouter signedIn={Boolean(session)} />
      <Stack
        screenOptions={{
          headerTintColor: theme.tint,
          headerTitleStyle: { fontFamily: fonts.displayMedium, color: theme.text },
          headerLargeTitleStyle: { fontFamily: fonts.display, color: theme.text },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Every screen past a tab's first one opens here, on top of the
              tabs, not inside a tab. Then back always returns to the screen
              it was opened from, whichever tab or page that was. A screen
              inside a tab can be opened from another tab or a website page,
              and back from it would go to that tab's own first screen. */}
          <Stack.Screen name="registry/[id]/index" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="registry/[id]/settings" options={{ title: "Settings", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="registry/[id]/checklist" options={{ title: "Registry Checklist", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="registry/[id]/suggestions" options={{ title: "Suggestions Inbox", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="registry/[id]/perks" options={{ title: "Store perks", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="registry/[id]/gifts" options={{ title: "Gift activity", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="registry/[id]/check" options={{ title: "Items to check", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="events/[eventId]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="events/group/[groupId]" options={{ title: "Group", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="account/profile" options={{ title: "Your profile", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="account/gift-profile" options={{ title: "Gift profile", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="account/follows" options={{ title: "Follows", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="add" options={{ presentation: "modal", title: "Add an item" }} />
          <Stack.Screen name="item/[id]" options={{ presentation: "modal", title: "Edit item" }} />
          <Stack.Screen name="new-registry" options={{ presentation: "modal", title: "New registry" }} />
          <Stack.Screen name="fund" options={{ presentation: "modal", title: "Gift fund" }} />
          <Stack.Screen name="idea" options={{ presentation: "modal", title: "Gift idea" }} />
          <Stack.Screen name="new" options={{ presentation: "modal", title: "Start something new" }} />
          <Stack.Screen name="event-form" options={{ presentation: "modal", title: "Plan an event" }} />
          <Stack.Screen name="saved-item" options={{ presentation: "formSheet", title: "Lists", sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true }} />
          <Stack.Screen name="place-items" options={{ presentation: "modal", title: "Add to list" }} />
          <Stack.Screen name="share" options={{ presentation: "modal", title: "Add to Regibee", gestureEnabled: false }} />
        </Stack.Protected>
        {/* Signed in or out: a link to a list or an invitation opens here
            either way. Signed out, the page shows as it does to guests. */}
        <Stack.Screen name="web" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
        {/* An invitation, at the website's own path, signed in or out. */}
        <Stack.Screen name="e/[slug]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
        {/* Someone else's list, at the website's own path, signed in or out. */}
        <Stack.Screen name="r/[slug]" options={{ title: "", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ title: "Create an account" }} />
          <Stack.Screen name="forgot-password" options={{ title: "Reset your password" }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

/**
 * Opens the add form when someone shares a product to Regibee from another
 * app. A share that arrives while signed out waits until they sign in.
 *
 * On iPhone the share opens a link that already lands on the share screen. On
 * Android the app comes to the front on whatever screen it was on, and this
 * moves it to the share screen. It does that once for each share: sharing
 * again opens the form again, and leaving it with the back button doesn't
 * bring it straight back.
 */
function ShareRouter({ signedIn }: { signedIn: boolean }) {
  const { shareIntent, hasShareIntent, error, resetShareIntent } = useShareIntentContext();
  const pathname = usePathname();
  // Each share arrives as a new object.
  const opened = useRef<object | null>(null);
  const shownError = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent || !signedIn || opened.current === shareIntent) return;
    opened.current = shareIntent;
    if (pathname !== "/share") router.navigate("/share");
  }, [hasShareIntent, signedIn, shareIntent, pathname]);

  // The share library reports a share it can't read as an error. On Android
  // that's any text not labeled as plain text. Say so instead of doing nothing.
  useEffect(() => {
    if (!error) {
      shownError.current = null;
      return;
    }
    if (shownError.current === error) return;
    shownError.current = error;
    Alert.alert(
      "Couldn't read what you shared",
      `Copy the product's link and add it on your registry instead.\n\n(${error})`,
    );
    // Clear it so the same failure shows again next time, unless that would
    // drop a share that's waiting.
    if (!hasShareIntent) resetShareIntent(false);
  }, [error, hasShareIntent, resetShareIntent]);

  return null;
}
