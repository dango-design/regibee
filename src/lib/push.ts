// Push notifications to the phone app: the parts with no server code, so the
// unit tests can run them. push-server.ts sends them.
//
// Expo's push service delivers them to iPhone and Android
// (https://docs.expo.dev/push-notifications/sending-notifications/). The app
// saves each phone's Expo push token in push_tokens after sign-in.
//
// Never put a gift idea in a push, and never tell an owner about a gift they
// hid from themselves. The senders in email.ts and push-server.ts use the
// same rules as the emails.

/** What a person sees, and the app screen a tap opens. */
export interface PushNotice {
  title: string;
  body?: string;
  /** An app route, like "/events/<id>". */
  path: string;
}

/** One message in Expo's format. */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body?: string;
  data: { path: string };
  sound: "default";
  /** The app's Android channel (mobile/src/lib/push.ts). */
  channelId: "default";
}

/** Expo's answer for one message, in the order they were sent. */
export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message?: string; details?: { error?: string } };

/** Expo takes at most 100 messages in one request. */
export const EXPO_PUSH_BATCH = 100;

// iOS shows about this much on a lock screen, and Expo refuses a message over 4 KB.
const TITLE_MAX = 120;
const BODY_MAX = 240;

export function isExpoPushToken(token: string): boolean {
  return token.length <= 200 && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** The messages for one notice, one per token, in batches Expo accepts. */
export function expoMessages(tokens: string[], notice: PushNotice): ExpoPushMessage[][] {
  const title = clip(notice.title, TITLE_MAX);
  const body = notice.body ? clip(notice.body, BODY_MAX) : undefined;
  const messages = [...new Set(tokens)].filter(isExpoPushToken).map(
    (to): ExpoPushMessage => ({
      to,
      title,
      ...(body ? { body } : {}),
      data: { path: notice.path },
      sound: "default",
      channelId: "default",
    })
  );
  const batches: ExpoPushMessage[][] = [];
  for (let start = 0; start < messages.length; start += EXPO_PUSH_BATCH) {
    batches.push(messages.slice(start, start + EXPO_PUSH_BATCH));
  }
  return batches;
}

/**
 * The tokens Expo says no longer reach a phone, such as after the app was
 * removed. Their rows should go, so nothing is sent to them again.
 */
export function unregisteredTokens(batch: ExpoPushMessage[], tickets: ExpoPushTicket[]): string[] {
  return batch
    .filter((message, index) => {
      const ticket = tickets[index];
      return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered";
    })
    .map((message) => message.to);
}

/** The screen a push opens: a path inside the app, never a website address. */
export function pushPath(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const path = (data as { path?: unknown }).path;
  return typeof path === "string" && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(path) ? path : null;
}
