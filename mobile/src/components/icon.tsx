import { SymbolView, type SymbolViewProps } from "expo-symbols";

// SF Symbols on iPhone, Material Symbols on Android and the web preview.
const ICONS = {
  add: { ios: "plus", android: "add" },
  share: { ios: "square.and.arrow.up", android: "share" },
  star: { ios: "star.fill", android: "star" },
  starOutline: { ios: "star", android: "star_outline" },
  trash: { ios: "trash", android: "delete" },
  check: { ios: "checkmark", android: "check" },
  checkCircle: { ios: "checkmark.circle.fill", android: "check_circle" },
  link: { ios: "link", android: "link" },
  paste: { ios: "doc.on.clipboard", android: "content_paste" },
  chevronRight: { ios: "chevron.right", android: "chevron_right" },
  person: { ios: "person.crop.circle", android: "person" },
  gift: { ios: "gift", android: "redeem" },
  bag: { ios: "bag", android: "shopping_bag" },
  external: { ios: "arrow.up.right.square", android: "open_in_new" },
  more: { ios: "ellipsis.circle", android: "more_horiz" },
  close: { ios: "xmark", android: "close" },
  edit: { ios: "pencil", android: "edit" },
  store: { ios: "storefront", android: "storefront" },
  fund: { ios: "banknote", android: "savings" },
  people: { ios: "person.2", android: "group" },
  signOut: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  public: { ios: "globe", android: "public" },
  lock: { ios: "lock", android: "lock" },
  calendar: { ios: "calendar", android: "calendar_today" },
  error: { ios: "exclamationmark.triangle", android: "error" },
  refresh: { ios: "arrow.clockwise", android: "refresh" },
  update: { ios: "arrow.down.circle", android: "system_update" },
  search: { ios: "magnifyingglass", android: "search" },
  minus: { ios: "minus", android: "remove" },
  settings: { ios: "gearshape", android: "settings" },
  image: { ios: "photo", android: "image" },
  eye: { ios: "eye", android: "visibility" },
  eyeSlash: { ios: "eye.slash", android: "visibility_off" },
  bookmark: { ios: "bookmark", android: "bookmark" },
  personAdd: { ios: "person.badge.plus", android: "person_add" },
  personRemove: { ios: "person.badge.minus", android: "person_remove" },
  checklist: { ios: "checklist", android: "checklist" },
  inbox: { ios: "tray", android: "inbox" },
  mail: { ios: "envelope", android: "mail" },
  copy: { ios: "doc.on.doc", android: "content_copy" },
  heart: { ios: "heart", android: "favorite" },
  party: { ios: "party.popper", android: "celebration" },
  clock: { ios: "clock", android: "schedule" },
  location: { ios: "mappin.and.ellipse", android: "place" },
  camera: { ios: "camera", android: "photo_camera" },
  unlink: { ios: "minus.circle", android: "link_off" },
  chat: { ios: "bubble.left", android: "chat_bubble" },
  sparkles: { ios: "sparkles", android: "auto_awesome" },
  cake: { ios: "birthday.cake", android: "cake" },
  list: { ios: "list.bullet", android: "list" },
  shuffle: { ios: "shuffle", android: "shuffle" },
  undo: { ios: "arrow.uturn.backward", android: "undo" },
  hand: { ios: "hand.raised", android: "back_hand" },
  block: { ios: "nosign", android: "block" },
  bell: { ios: "bell", android: "notifications" },
  filter: { ios: "line.3.horizontal.decrease.circle", android: "filter_list" },
  home: { ios: "house", android: "home" },
  cart: { ios: "cart", android: "shopping_cart" },
  info: { ios: "info.circle", android: "info" },
  checkbox: { ios: "checkmark.square.fill", android: "check_box" },
  checkboxEmpty: { ios: "square", android: "check_box_outline_blank" },
  send: { ios: "paperplane", android: "send" },
  truck: { ios: "shippingbox", android: "local_shipping" },
  card: { ios: "creditcard", android: "credit_card" },
  tag: { ios: "tag", android: "sell" },
  person1: { ios: "person", android: "person_outline" },
  arrowUp: { ios: "arrow.up", android: "arrow_upward" },
  arrowDown: { ios: "arrow.down", android: "arrow_downward" },
  baby: { ios: "stroller", android: "child_friendly" },
  contacts: { ios: "person.crop.rectangle.stack", android: "contacts" },
} as const satisfies Record<string, { ios: string; android: string }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
  weight,
}: {
  name: IconName;
  size?: number;
  color: string;
  weight?: "regular" | "medium" | "semibold" | "bold";
}) {
  const icon = ICONS[name];
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android } as SymbolViewProps["name"]}
      size={size}
      tintColor={color}
      weight={weight ? ({ ios: weight } as SymbolViewProps["weight"]) : undefined}
    />
  );
}
