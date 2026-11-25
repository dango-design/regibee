// A page of the website, inside the app: someone else's list, a profile, an
// invitation, a group gift or an invite link. The page is signed in as this
// account (src/lib/web.ts), so reserving a gift, following someone or sending
// an RSVP works as it does for the account on the website.
//
// Links to things the app has its own screen for, such as a list this account
// manages, open that screen. Links to other sites, such as a store, open in
// the browser.

import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, Share, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { appScreenForPath, IN_APP_HEADER } from "@shared/in-app";

import { ErrorState, IconButton, LoadingState } from "@/components/ui";
import { SITE_URL } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { freshAccessToken, signedInAddress, sitePath } from "@/lib/web";

/** The path of an address on the website, or null for another site. */
function pathOnSite(url: string): string | null {
  if (!url.startsWith(SITE_URL)) return null;
  const rest = url.slice(SITE_URL.length);
  return rest === "" || /^[/?#]/.test(rest) ? rest || "/" : null;
}

export default function WebScreen() {
  const { path: pathParam } = useLocalSearchParams<{ path: string }>();
  const path = sitePath(pathParam ?? "/");
  const theme = useTheme();
  const web = useRef<WebView<object>>(null);
  // undefined while the token is being read, null when signed out.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [current, setCurrent] = useState(`${SITE_URL}${path}`);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    freshAccessToken()
      .catch(() => null)
      .then((value) => {
        if (live) setToken(value);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  // Android's back button goes back a page first, then leaves the screen.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      web.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  /** Opens the app's own screen for a website path. True when it has one. */
  const openInApp = useCallback((sitePathname: string): boolean => {
    const target = appScreenForPath(sitePathname);
    if (!target) return false;
    if (target.screen === "registry") router.replace({ pathname: "/registry/[id]", params: { id: target.id } });
    else if (target.screen === "event") router.replace({ pathname: "/events/[eventId]", params: { eventId: target.id } });
    else if (target.screen === "group") router.replace({ pathname: "/events/group/[groupId]", params: { groupId: target.id } });
    else router.back();
    return true;
  }, []);

  function onNavigation(state: WebViewNavigation) {
    setCanGoBack(state.canGoBack);
    const sitePathname = pathOnSite(state.url);
    // The website moves between its own pages without loading a new one, which
    // onShouldStartLoadWithRequest doesn't see. Catch those here.
    if (sitePathname && openInApp(sitePathname)) {
      web.current?.stopLoading();
      return;
    }
    if (sitePathname && !sitePathname.startsWith("/api/app/open")) setCurrent(state.url);
    if (state.title && !state.title.startsWith("http")) setTitle(state.title.replace(/\s*\|\s*Regibee$/, ""));
  }

  if (token === undefined) return <LoadingState />;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <IconButton
                icon="share"
                accessibilityLabel="Share this page's link"
                onPress={() => Share.share(Platform.OS === "ios" ? { url: current } : { message: current })}
              />
              <IconButton icon="external" accessibilityLabel="Open in your browser" onPress={() => WebBrowser.openBrowserAsync(current)} />
            </View>
          ),
        }}
      />
      {failed ? (
        <ErrorState
          message="You're offline, or Regibee can't be reached. Try again."
          onRetry={() => {
            setFailed(false);
            setToken(undefined);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <WebView
          key={attempt}
          ref={web}
          source={{ uri: signedInAddress(path), headers: token ? { [IN_APP_HEADER]: "1", Authorization: `Bearer ${token}` } : { [IN_APP_HEADER]: "1" } }}
          style={{ flex: 1, backgroundColor: theme.background }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.background }}>
              <LoadingState />
            </View>
          )}
          onNavigationStateChange={onNavigation}
          onError={() => setFailed(true)}
          onShouldStartLoadWithRequest={(request) => {
            // Frames inside the page, such as an embedded map, load as they are.
            if (request.isTopFrame === false) return true;
            if (!/^https?:/i.test(request.url)) return false;
            const sitePathname = pathOnSite(request.url);
            if (sitePathname === null) {
              // A store or any other site opens in the browser, signed out of Regibee.
              WebBrowser.openBrowserAsync(request.url);
              return false;
            }
            return !openInApp(sitePathname);
          }}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          pullToRefreshEnabled
        />
      )}
    </>
  );
}
