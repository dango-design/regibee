// A page of the website, inside the app: someone else's list, a profile, an
// invitation, a group gift or an invite link. The page is signed in as this
// account (src/lib/web.ts), so reserving a gift, following someone or sending
// an RSVP works as it does for the account on the website.
//
// Links to things the app has its own screen for, such as a list this account
// manages or an invitation, open that screen. Links to other sites, such as a
// store, open in the browser.
//
// The header matches the page. The website follows the phone's light or dark
// setting, and so do the header, the status bar and the background behind the
// page. iOS tells the page the phone's setting. On Android, the web view tells
// it the app's setting, which follows the phone. forceDarkOn stays off, so
// Android uses the website's own dark colours instead of darkening a light
// page itself.
//
// The guest's gifts follow them between the app's own list screen and these
// pages. Opening the page sends the gifts the app keeps (src/lib/my-gifts.ts)
// to the website with the first request, which adds them to the website's
// gifts cookie. A gift given on a page here comes back the other way: a
// script in the page reads that cookie whenever it changes, and the app keeps
// the new gifts. The rules are in the website's src/lib/my-gifts-cookie.ts.
//
// The header has no title while the page's own title shows. Once the page's
// title scrolls up under the header, the header fills in: that title fades
// into it and a line appears under it, as in Spotify or Apple Music.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Platform, Share, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";

import { appScreenForPath, IN_APP_HEADER } from "@shared/in-app";
import { APP_GIFTS_HEADER, MAX_APP_GIFTS, MY_GIFTS_COOKIE, newGifts, webViewGifts } from "@shared/my-gifts-cookie";

import { ErrorState, IconButton, LoadingState } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { readMyGifts, rememberGifts } from "@/lib/my-gifts";
import { publicListKeys } from "@/lib/public-list-data";
import { SITE_URL } from "@/lib/supabase";
import { fonts, useSitePageColors, type SitePageColors } from "@/lib/theme";
import { freshAccessToken, nativeRoute, nativeScreenKey, signedInAddress, sitePath } from "@/lib/web";

/** The path of an address on the website, or null for another site. */
function pathOnSite(url: string): string | null {
  if (!url.startsWith(SITE_URL)) return null;
  const rest = url.slice(SITE_URL.length);
  return rest === "" || /^[/?#]/.test(rest) ? rest || "/" : null;
}

// Runs in each page. It tells the screen whether the page's title (its first
// h1) has scrolled up past the top of the web view, under the header, and
// what the title says. A page with no h1 counts as scrolled once it moves at
// all. It checks again when the page changes without loading a new one, as
// the website does between its own pages.
const HEADER_SCRIPT = `(function () {
  if (window.__regibeeHeader) return;
  window.__regibeeHeader = true;
  var last = null;
  var queued = false;
  function check() {
    queued = false;
    var title = document.querySelector("main h1") || document.querySelector("h1");
    var shown = title && title.getClientRects().length > 0;
    var filled = shown ? title.getBoundingClientRect().bottom <= 0 : window.scrollY > 0;
    var heading = shown ? title.textContent.replace(/\\s+/g, " ").trim() : "";
    var key = filled + "|" + heading;
    if (key === last) return;
    last = key;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "header", filled: filled, heading: heading }));
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(check);
  }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  check();
})();`;

// Runs in each page. It sends the screen the website's gifts cookie each time
// it changes: when the page loads, and after a gift is saved on it. The
// cookie is readable in the page on purpose (MY_GIFTS_COOKIE_OPTIONS on the
// website). Checking once a second is cheap, and catches every way a gift
// is saved without the website having to tell the app.
const GIFTS_SCRIPT = `(function () {
  if (window.__regibeeGifts) return;
  window.__regibeeGifts = true;
  var last = null;
  function check() {
    var match = document.cookie.match(/(?:^|;\\s*)${MY_GIFTS_COOKIE}=([^;]*)/);
    var value = match ? match[1] : "";
    if (value === last) return;
    last = value;
    if (value) window.ReactNativeWebView.postMessage(JSON.stringify({ type: "gifts", cookie: value }));
  }
  check();
  setInterval(check, 1000);
})();`;

const PAGE_SCRIPT = `${HEADER_SCRIPT}\n${GIFTS_SCRIPT}\ntrue;`;

/** The header's title, which fades in once the page's own title has scrolled under it. */
function HeaderTitle({
  title,
  shown,
  opacity,
  colors,
}: {
  title: string;
  shown: boolean;
  opacity: Animated.Value;
  colors: SitePageColors;
}) {
  return (
    <Animated.Text
      numberOfLines={1}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
      style={{ opacity, fontFamily: fonts.displayMedium, fontSize: 17, color: colors.text }}
    >
      {title}
    </Animated.Text>
  );
}

export default function WebScreen() {
  const { path: pathParam } = useLocalSearchParams<{ path: string }>();
  const path = sitePath(pathParam ?? "/");
  const { session, userId } = useSession();
  const queryClient = useQueryClient();
  const site = useSitePageColors();
  const web = useRef<WebView<object>>(null);
  // undefined while the token is being read, null when signed out.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  // The app's gifts, as the APP_GIFTS_HEADER value, sent with the first request.
  const [giftsHeader, setGiftsHeader] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [current, setCurrent] = useState(`${SITE_URL}${path}`);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The page's title has scrolled up under the header, and what it says.
  const [filled, setFilled] = useState(false);
  const [heading, setHeading] = useState("");
  // Fades the header's title and the line under it in and out together.
  const [fill] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fill, { toValue: filled ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [filled, fill]);

  useEffect(() => {
    let live = true;
    (async () => {
      const value = await freshAccessToken().catch(() => null);
      // The newest gifts: more wouldn't fit in the website's cookie.
      const gifts = value && userId ? Object.entries(await readMyGifts(userId)).slice(-MAX_APP_GIFTS) : null;
      if (!live) return;
      setGiftsHeader(gifts ? JSON.stringify(Object.fromEntries(gifts)) : null);
      setToken(value);
    })();
    return () => {
      live = false;
    };
  }, [attempt, userId]);

  // The gifts the cookie held the last time the page sent it. Only gifts that
  // are new since then are kept, so a page left open under another screen
  // never puts back an older gift over one given there since.
  const cookieGifts = useRef<Record<string, string>>({});

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

  // The last app screen opened from this page, so one tap doesn't open it twice.
  const lastOpened = useRef({ path: "", at: 0 });

  /**
   * Opens the app's own screen for a website path. True when it has one. The
   * screen opens on top of this page, so back from it comes back here.
   */
  const openInApp = useCallback((sitePathname: string): boolean => {
    // A page the app has its own screen for, such as an invitation, opens
    // there, on top of this one. Not the screen this web view was opened
    // for: the native screen sends a page here when it can't show it itself.
    // A gift link (/e/<event>/gifts?to=<list>) redirects to its list, which
    // is the same screen, so it stays here too. Signed out too: the native
    // guest screens work without an account.
    const ownScreen = nativeScreenKey(path) ?? path.split(/[?#]/)[0];
    const native = (nativeScreenKey(sitePathname) ?? sitePathname.split(/[?#]/)[0]) !== ownScreen ? nativeRoute(sitePathname) : null;
    const target = native ? null : appScreenForPath(sitePathname);
    if (!native && !target) return false;
    const now = Date.now();
    if (lastOpened.current.path === sitePathname && now - lastOpened.current.at < 1000) return true;
    lastOpened.current = { path: sitePathname, at: now };
    if (native) {
      router.push(native);
      return true;
    }
    if (!target) return false;
    if (target.screen === "registry") router.push({ pathname: "/registry/[id]", params: { id: target.id } });
    else if (target.screen === "event") router.push({ pathname: "/events/[eventId]", params: { eventId: target.id } });
    else if (target.screen === "group") router.push({ pathname: "/events/group/[groupId]", params: { groupId: target.id } });
    else router.back();
    return true;
  }, [path]);

  function onNavigation(state: WebViewNavigation) {
    setCanGoBack(state.canGoBack);
    const sitePathname = pathOnSite(state.url);
    // The website moves between its own pages without loading a new one, which
    // onShouldStartLoadWithRequest doesn't see. Catch those here. By now the
    // page has already moved on, so step it back to where it was: that's the
    // page someone expects to see when they come back from the app's screen.
    if (sitePathname && openInApp(sitePathname)) {
      web.current?.stopLoading();
      if (state.canGoBack) web.current?.goBack();
      return;
    }
    if (sitePathname && !sitePathname.startsWith("/api/app/open")) setCurrent(state.url);
    if (state.title && !state.title.startsWith("http")) setTitle(state.title.replace(/\s*\|\s*Regibee$/, ""));
  }

  /** Keeps the gifts given on a page here that the app doesn't know yet. */
  function onGiftsCookie(cookie: string) {
    if (!session || !userId) return;
    const current = webViewGifts(cookie, userId);
    if (!current) return;
    const added = newGifts(cookieGifts.current, current);
    cookieGifts.current = current;
    if (Object.keys(added).length === 0) return;
    rememberGifts(userId, added)
      .then(() => queryClient.invalidateQueries({ queryKey: publicListKeys.all }))
      .catch(() => {
        // Kept next time the page sends the cookie.
        cookieGifts.current = {};
      });
  }

  function onMessage(event: WebViewMessageEvent) {
    // Only this site's pages. Frames inside them, like a map, can post too.
    if (pathOnSite(event.nativeEvent.url) === null) return;
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        filled?: unknown;
        heading?: unknown;
        cookie?: unknown;
      };
      if (message.type === "gifts" && typeof message.cookie === "string") {
        onGiftsCookie(message.cookie);
        return;
      }
      if (message.type !== "header") return;
      setFilled(message.filled === true);
      setHeading(typeof message.heading === "string" ? message.heading : "");
    } catch {
      // Not one of ours.
    }
  }

  if (token === undefined) return <LoadingState />;

  // While a page shows, the header takes the page's colours. With no page,
  // such as when it can't load, it keeps the app's.
  const onPage = !failed;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          ...(onPage
            ? {
                headerStyle: { backgroundColor: site.background },
                headerTintColor: site.tint,
                // The page's own title, which just scrolled up under the
                // header, or the page's name when it has none.
                headerTitle: () => <HeaderTitle title={heading || title} shown={filled} opacity={fill} colors={site} />,
              }
            : {}),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <IconButton
                icon="share"
                accessibilityLabel="Share this page's link"
                color={onPage ? site.tint : undefined}
                onPress={() => Share.share(Platform.OS === "ios" ? { url: current } : { message: current })}
              />
              <IconButton
                icon="external"
                accessibilityLabel="Open in your browser"
                color={onPage ? site.tint : undefined}
                onPress={() => WebBrowser.openBrowserAsync(current)}
              />
            </View>
          ),
        }}
      />
      {/* Clock and battery icons that show up on the header's colour. */}
      {onPage && <StatusBar style={site.dark ? "light" : "dark"} />}
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
          source={{
            uri: signedInAddress(path),
            headers: token
              ? {
                  [IN_APP_HEADER]: "1",
                  Authorization: `Bearer ${token}`,
                  ...(giftsHeader ? { [APP_GIFTS_HEADER]: giftsHeader } : {}),
                }
              : { [IN_APP_HEADER]: "1" },
          }}
          style={{ flex: 1, backgroundColor: site.background }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: site.background }}>
              <LoadingState />
            </View>
          )}
          onNavigationStateChange={onNavigation}
          injectedJavaScript={PAGE_SCRIPT}
          onMessage={onMessage}
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
      {/* The line under the filled header. It's drawn here, not with
          headerShadowVisible, which iOS 26 doesn't draw. */}
      {onPage && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: site.border,
            opacity: fill,
          }}
        />
      )}
    </>
  );
}
