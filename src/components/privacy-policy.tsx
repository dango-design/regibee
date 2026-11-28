import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { EXTENSION_STORES } from "@/lib/retailers";

// The privacy policy at /privacy. The app stores and the Chrome Web Store link
// here, so keep it true to what the code does: when Regibee starts collecting
// something new, sharing it with a new service, or keeping it somewhere new,
// change this page in the same pull request and update EFFECTIVE_DATE.
//
// The nav is passed in because the real one is a server component, which
// Storybook can't render. Stories pass the presentational NavBar instead.

/** Where Regibee is run from, how to reach it, and when this version took effect. */
export const PRIVACY_FACTS = {
  effectiveDate: "November 27, 2026",
  contactEmail: "contact@regibee.com",
  location: "California, United States",
};

// "Amazon, Target, Walmart and Pottery Barn Kids", from the same list the
// extension's site access is built from.
const storeNames = EXTENSION_STORES.map((s) => s.name);
const extensionStores =
  storeNames.length > 1 ? `${storeNames.slice(0, -1).join(", ")} and ${storeNames[storeNames.length - 1]}` : storeNames.join("");

const linkClass =
  "rounded-sm font-medium text-brand-tertiary underline underline-offset-4 outline-focus-ring hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2";

const sections = [
  { id: "accounts", title: "If you have an account" },
  { id: "guests", title: "If you give a gift, suggest one or RSVP" },
  { id: "app", title: "The Regibee app" },
  { id: "extension", title: "The browser extension" },
  { id: "emails", title: "Emails" },
  { id: "cookies", title: "Cookies and what's stored on your device" },
  { id: "use", title: "How we use it" },
  { id: "sharing", title: "Who else handles it" },
  { id: "your-choices", title: "See, change or delete your information" },
  { id: "keeping", title: "How long we keep it" },
  { id: "security", title: "Security" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us" },
] as const;

type SectionId = (typeof sections)[number]["id"];

function Section({ id, children }: { id: SectionId; children: React.ReactNode }) {
  const title = sections.find((s) => s.id === id)!.title;
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="scroll-mt-24 font-display text-display-xs font-semibold text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 font-semibold text-primary">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-secondary">{children}</p>;
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5 text-secondary marker:text-quaternary">{children}</ul>;
}

function ContactEmail() {
  return (
    <a href={`mailto:${PRIVACY_FACTS.contactEmail}`} className={linkClass}>
      {PRIVACY_FACTS.contactEmail}
    </a>
  );
}

/** The privacy policy page's markup. */
export function PrivacyPolicy({ nav }: { nav: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {nav}
      <main id="main-content" className="flex-1">
        <article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <header>
            <h1 className="font-display text-display-sm font-semibold text-primary sm:text-display-md">
              Privacy policy
            </h1>
            <p className="mt-3 text-sm text-tertiary">Effective {PRIVACY_FACTS.effectiveDate}</p>
            <p className="mt-6 text-lg text-secondary">
              Regibee is a gift registry. Owners make registries and events and share them. Guests reserve gifts
              and RSVP without an account. This page says what we collect from each, why, who else handles it,
              and how to see, change or delete it. It covers regibee.com, the Regibee app for iPhone and Android,
              and the Regibee browser extension.
            </p>
          </header>

          <div className="mt-8 rounded-2xl border bg-secondary p-6">
            <h2 className="font-display text-lg font-semibold text-primary">The short version</h2>
            <List>
              <li>
                We collect what you give us, what Regibee needs to work, and counts of how Regibee is used, so we
                can make it better.
              </li>
              <li>
                There are no ads and no tracking cookies. We count things like how many lists are made and which
                pages are opened, with PostHog, without your name, your email or anything about your gift ideas.
                Our emails record whether they&apos;re opened and clicked. We don&apos;t sell your information or
                share it for advertising.
              </li>
              <li>Regibee never handles money. Guests pay owners directly, with Venmo, PayPal, Zelle or however the owner asks.</li>
              <li>
                You can change or delete what you&apos;ve added at any time, and delete your account on your{" "}
                <Link href="/dashboard/account" className={linkClass}>
                  Account page
                </Link>
                .
              </li>
            </List>
          </div>

          <nav aria-label="On this page" className="mt-10">
            <h2 className="text-sm font-semibold text-primary">On this page</h2>
            <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={linkClass}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <Section id="accounts">
            <H3>Your account</H3>
            <P>
              To make an account you give your name, email address and a password. Supabase, which runs our
              sign-in, keeps only a scrambled form of the password (a hash), so nobody at Regibee can read it.
            </P>
            <P>
              When you use Regibee to email other people, such as invitations or messages to your guests, we keep
              how many emails went out, when and what kind, but not who they went to. We count the emails a list,
              event or group gift sends when someone reserves a gift, RSVPs or chips in there the same way. That
              lets us limit how many one account, or one page, sends in a day. Some accounts, such as people
              helping us test Regibee, have higher limits.
            </P>

            <H3>Your profile</H3>
            <P>
              Every account has a profile page with your name and the registries you choose to show there. Its
              link has a random code in it, so people find it only if you share it or they find you in search.
              Profiles are hidden from search engines.
            </P>
            <P>
              You can add a profile photo, which anyone who opens your profile can see. Before it&apos;s uploaded,
              your browser makes a small square copy of it, which leaves out the photo&apos;s other details, such
              as where it was taken. We delete it when you change or remove it, or delete your account.
            </P>
            <P>
              Signed-in people can find you on Regibee by name if you turn that on, and by typing your whole email
              address unless you turn that off. The &ldquo;Let friends find me&rdquo; box when you sign up covers
              both, and each has its own setting on your Account page. Search never shows your email address.
            </P>

            <H3>Your gift profile</H3>
            <P>
              If you fill it in on your Account page, we keep your birthday (the month and day, no year), your
              sizes, favorite colors, likes, things to skip and notes. It shows on your personal wishlists and your
              profile. You choose who sees your birthday, your sizes, and your likes and dislikes: only you, your
              friends (people you follow who follow you back), the followers you&apos;ve approved, or everyone who
              opens your profile or wishlists. Unless you change it, your birthday shows to your approved
              followers and the rest to your friends. Followers or friends who see your birthday also get it on
              their Following page, and in an email we send them 10 days before.
            </P>
            <P>
              You can also write a public note on your Account page. We keep it, and anyone who opens your profile
              sees it under your name.
            </P>
            <P>
              A list you keep for a child can have its own gift profile, which you and anyone helping you manage
              the list fill in on its settings page. It shows on that list, to anyone who opens it. The child&apos;s birthday shows only to
              the people who manage the list and to followers you&apos;ve approved, while the list is on your
              profile.
            </P>

            <H3>Your registries</H3>
            <List>
              <li>
                What you put on them: the title, date, description and photo, names such as the parents&apos; or the
                guest of honor&apos;s, the items with their links, prices, pictures and notes, your categories and your
                cash funds. When a store&apos;s page shows a product&apos;s barcode number (its UPC or EAN), we keep
                that with the item too.
              </li>
              <li>
                You choose who can open each registry. New registries start as &ldquo;Anyone with the link&rdquo;:
                the link ends in a random code, so people find it only if someone shares it with them. These are
                hidden from search engines. Public registries open for anyone with the link and can show up in search
                engines.
              </li>
              <li>
                You also choose who sees each registry on your profile: nobody, your friends (people you follow who
                follow you back), followers you&apos;ve approved, or, for a public registry, anyone who opens your
                profile. A registry also shows there to people in a group you&apos;ve shared it with. This choice is
                only about your profile: anyone who has a registry&apos;s link can still open it, unless it&apos;s
                private.
              </li>
              <li>
                Private registries open only for you and your co-managers. Their link doesn&apos;t work for anyone
                else, guests&apos; gift emails included. They don&apos;t show on your profile, and making a registry
                private takes it off any event or group you&apos;ve shared it with.
              </li>
              <li>
                You can get a new link for a registry at any time, and the old one stops opening it. We keep the old
                link so the emails guests got about their gifts still take them to those gifts. It doesn&apos;t open
                the registry for anyone else.
              </li>
              <li>
                Photos you upload for a registry or an item can be seen by anyone with the registry&apos;s link.
              </li>
              <li>
                <strong className="font-semibold text-primary">Shipping address.</strong> If you add one, a guest sees
                it only after they reserve a gift from your registry.
              </li>
              <li>
                <strong className="font-semibold text-primary">Payment handles.</strong> If you add your Venmo, PayPal
                or Zelle details for cash funds, anyone with your registry&apos;s link can see them, because guests
                use them to pay you directly. Regibee never sees or moves the money. When a guest says they sent
                some, we record the amount they tell us.
              </li>
              <li>
                <strong className="font-semibold text-primary">ZIP code.</strong> If you turn on tax estimates, we use
                your ZIP code to estimate sales tax on prices.
              </li>
              <li>Links to your registries at other stores, if you add them.</li>
              <li>
                If you invite someone to help manage a registry, we email them a link. Once they join, they see and
                can change everything on it that you can, gift givers&apos; details included.
              </li>
            </List>

            <H3>Your events</H3>
            <P>
              For an event you add its details, which can include a date, a place and its address, a message, a gift
              note and an invitation picture, questions to ask when guests RSVP, a sign-up sheet, and a guest list
              with names and email addresses. We keep a copy of the messages you send guests, so you can see what
              you sent, and show them on the event&apos;s page, with a line when its date, time or place changes, so
              guests without email see them too. You can link
              registries to it, yours or anyone else&apos;s you have the link to, and we email a registry&apos;s
              owners when you link it. Guests opening the event&apos;s link see its details. Event pages are hidden
              from search engines.
            </P>
            <List>
              <li>
                The guest list and the RSVPs are only for you and your co-hosts. You can invite co-hosts by email or
                with a link, and they can manage the event with you.
              </li>
              <li>
                Emails we send for your event, such as invitations, reminders, your messages, updates when its
                details change, Secret Santa names and gift list requests, reply to your email address, so people
                who reply see it.
              </li>
              <li>
                In a gift exchange that draws names, you see who has joined and how many have added a wishlist or
                address, but not who drew whom or what anyone added. When everyone gives everyone, you and your
                guests see everyone&apos;s wishlists on the invitation.
              </li>
              <li>
                You can ask the person an event is for to make a gift list. We email them a link, and keep their name
                and email address with the event.
              </li>
              <li>
                You can add people who approved your follow to your guest list without typing their email address.
                We use the email address on their Regibee account to send their invitation and keep it with the
                event. A host sees it only if they and that guest follow each other. Otherwise it shows as private,
                on the guest list and on any group saved from it.
              </li>
            </List>

            <H3>Your groups</H3>
            <P>
              A group is a list of people you keep, like a family or a book club, with their names and, if you add
              them, email addresses. Only you see who&apos;s in it, and we don&apos;t email people when you add them.
              We match members to Regibee accounts by email address. When you share a registry with a group,
              members who have an account see it, with the group&apos;s name, on their Following page and your
              profile, even if the registry is private.
            </P>

            <H3>Your gift ideas</H3>
            <P>
              If you save gift ideas for other people, we keep what you save: the name you give the person, such as
              &ldquo;Mom&rdquo;, and the idea&apos;s name, link, price, picture and your note, and the product&apos;s
              barcode number when the store&apos;s page shows it. No one else using Regibee can see them.
              They aren&apos;t on any registry and have no link, we never show them to the person or anyone else, and
              we don&apos;t email anyone about them.
            </P>

            <H3>Following and blocking</H3>
            <P>
              We keep who you follow, who follows you, follow requests and who you&apos;ve blocked. When you search
              for people by name or email, we keep the time of each search, not what you typed, so we can limit
              how many searches one account makes. If you send a follow invite to an email address, we email it and keep
              only a scrambled form of the address, so the same address can&apos;t be invited again and again.
              Someone whose follow you&apos;ve approved can add you to an event&apos;s guest list, and we send the
              invitation to your account&apos;s email address. They see that address only if you follow each other.
            </P>
          </Section>

          <Section id="guests">
            <P>You don&apos;t need an account to give a gift or RSVP.</P>
            <List>
              <li>
                <strong className="font-semibold text-primary">Giving a gift.</strong> You give your name, your email
                address and, if you like, a message. We record what you gave: the item and how many, or the amount
                you sent to a cash fund. The registry&apos;s owner and anyone helping them manage it see your name,
                email, message and gift. If the owner hides what&apos;s been reserved from themselves, they see it the
                day after an event the list is part of. Other guests only see that an item is reserved or given, not
                by whom. If you give from an event&apos;s invitation, the gift is matched to your RSVP. At an event
                where everyone gives everyone, that event&apos;s other guests then see your name on what you
                reserved from the lists on its invitation.
              </li>
              <li>
                <strong className="font-semibold text-primary">Suggesting an item.</strong> The owners get your
                suggestion with your name and email address.
              </li>
              <li>
                <strong className="font-semibold text-primary">RSVPing.</strong> A host may add your name and email
                address to their guest list to invite you. When you reply, the host and their co-hosts see your
                answer, how many people are coming (and how many are kids, if the host asks) and any note you add.
                They also see your answers to any questions they ask, such as meal choices, allergies or dietary
                needs, and the names of the people coming with you. Other guests don&apos;t. Your personal RSVP link
                has a secret code in it, so keep it to yourself.
              </li>
              <li>
                <strong className="font-semibold text-primary">Sign-up sheets.</strong> If an event has one, you can
                take a spot, like bringing a dish or a meal train day, with a note. Hosts see who took what. Other
                guests see what&apos;s taken, not by whom. A meal train&apos;s drop-off address shows only to guests
                who signed up for a day.
              </li>
              <li>
                <strong className="font-semibold text-primary">Gift exchanges (Secret Santa).</strong> If you join
                one, you can add a wishlist link and gift ideas, and a shipping address when gifts are mailed. Only
                the person who draws your name sees them, and only you see whose name you drew. A gift you give as
                someone&apos;s Secret Santa shows their registry&apos;s owners &ldquo;Secret Santa&rdquo; instead of
                your name and email, even after the event. We keep those apart, only to send you emails about your
                gift.
              </li>
              <li>
                <strong className="font-semibold text-primary">Everyone gives everyone.</strong> At an event where
                every guest gives to everyone, you add one of your Regibee wishlists after you RSVP, which takes an
                account. The event&apos;s guests and hosts see it on the invitation, with your name.
              </li>
              <li>
                <strong className="font-semibold text-primary">Group gifts.</strong> Someone with an account can
                start a group gift on an item and share its link, so friends can chip in. The item shows as reserved
                by their first name &ldquo;and others&rdquo;, and anyone with the link sees the total they&apos;re
                collecting and how to pay them back. To chip in, you give your name, your email address and an
                amount. The person who started it sees your name, email, amount and whether they&apos;ve marked it
                paid. Others with the link see your name and the total so far, not your amount. The person the gift
                is for, and anyone helping manage their list, see only that the item is reserved, never who chipped
                in or how much. Regibee doesn&apos;t handle the money: you pay the person who started it directly.
              </li>
              <li>
                When you give a gift or suggest an item, your browser gets an anonymous Regibee session: a random
                ID with no name or email attached. A cookie also remembers which gifts you gave from that browser,
                so the registry can show you your own gifts.
              </li>
            </List>
          </Section>

          <Section id="app">
            <P>
              The app signs in to the same account and does what your account can do on the website, under the
              same rules: your registries, saved items and gift ideas, events, following and settings. For most
              screens it asks regibee.com for what to show, and sends your changes there, with your sign-in.
            </P>
            <List>
              <li>
                <strong className="font-semibold text-primary">Sharing and pasting products.</strong> When you share
                a product to Regibee or paste a link, the app reads the product&apos;s name, price, pictures,
                barcode number and the store&apos;s category for it on your phone. The category only helps suggest
                one of yours and isn&apos;t saved. A link from another app, or a pasted one, opens in a hidden browser view on your phone, so the
                store sees a visit from your phone just as if you&apos;d opened the page yourself. Nothing goes to
                Regibee until you save the item.
              </li>
              <li>The app reads your clipboard only when you tap Paste.</li>
              <li>
                <strong className="font-semibold text-primary">Other people&apos;s pages.</strong> Someone else&apos;s
                registry, profile or invitation opens as its regibee.com page inside the app, signed in as you, so
                it works the way it does for your account on the website. That page keeps the same cookies in the
                app that regibee.com keeps in a browser. The app and that page share which gifts you gave: when the
                app opens a page, it sends regibee.com your gifts so the page shows them as yours, and it reads the
                page&apos;s gifts cookie to learn about gifts you gave there. The cookie inside the app also notes
                which account the gifts belong to, so another account signed in on the same phone doesn&apos;t get
                them. A link to a store or any other site opens in your
                phone&apos;s browser.
              </li>
              <li>
                <strong className="font-semibold text-primary">Updates.</strong> Each time the app opens, it asks
                Expo, which delivers the app&apos;s updates, whether there&apos;s a newer version. It sends which
                version it&apos;s running, whether your phone is an iPhone or Android, and a random ID the app made
                for your phone, which Expo uses to count how many phones run each version. Your account and
                registries aren&apos;t sent.
              </li>
              <li>
                <strong className="font-semibold text-primary">Kept on your phone.</strong> Your sign-in session, a
                copy of what you last saw, such as your registries and events, so the app opens quickly, the
                registry you last added to, and the gifts you gave on other people&apos;s lists, so the app knows
                they&apos;re yours. With notifications on, it also keeps the phone&apos;s notification token
                and whether you turned notifications off. Signing out removes the session, the copy and the token. Deleting the app removes everything it kept.
              </li>
              <li>
                <strong className="font-semibold text-primary">The demo.</strong> &ldquo;Look around first&rdquo;
                shows a sample registry held in the app&apos;s memory. Nothing you do in it is saved or sent to us.
              </li>
              <li>
                <strong className="font-semibold text-primary">Photos and the camera.</strong> When you add a photo,
                you choose between taking one and picking one. Picking opens your phone&apos;s photo picker, and the
                app only gets the photo you choose. Taking one asks for the camera the first time, and the app only
                gets the photo you take. Either way it shrinks the photo and uploads it as the picture for an item, a
                registry, an invitation or your profile, the same as the website does.
              </li>
              <li>
                <strong className="font-semibold text-primary">Contacts.</strong> When you tap Add from contacts on
                an event&apos;s guest list or a group, your phone&apos;s contact picker opens. The app reads the name
                and email addresses of the one person you pick and puts them in the form. Nothing is sent until you
                tap Add, and then only that name and the email you chose. On iPhone this needs no permission. On
                Android the app has to ask to read your contacts first, and it still only reads the person you pick.
              </li>
              <li>
                <strong className="font-semibold text-primary">Notifications.</strong> After you sign in, the app
                asks whether to send you notifications. If you allow them, it saves a token for your phone with your
                account, so we can tell you when someone asks to follow you, replies to your event&apos;s
                invitation, or gives a gift on your registry. A gift you hid from yourself stays hidden. We send them
                through Expo, which passes them to Apple or Google to deliver. A notification shows on your lock
                screen unless you change that in your phone&apos;s settings. Turn them off on the Account tab or in
                your phone&apos;s settings. Signing out or turning them off deletes the token.
              </li>
              <li>
                <strong className="font-semibold text-primary">Usage counts.</strong> The app tells PostHog which
                screens you open and when it opens or closes, with your phone&apos;s model, system version and
                language and the app&apos;s version, and, once you sign in, your account&apos;s ID. Screen names
                never say which registry, item or event, and the gift idea screen isn&apos;t counted. The app keeps a
                random ID for your phone and any counts it hasn&apos;t sent yet. Signing out starts a new ID.
              </li>
              <li>The app doesn&apos;t ask for your location or microphone.</li>
            </List>
          </Section>

          <Section id="extension">
            <P>
              The Chrome extension brings the items on your registries at {extensionStores} into Regibee. It reads
              pages only in these cases:
            </P>
            <List>
              <li>
                <strong className="font-semibold text-primary">Your store registry pages.</strong> When you open your
                registry at one of those stores, it reads the items on the page: their names, prices, pictures,
                quantities and registry links. It compares them with your Regibee registry. Items are added to
                Regibee when you pick them, or on their own if you turn on automatic mode. Items already on Regibee
                get their store registry links, so gifts bought through Regibee count at the store.
              </li>
              <li>
                <strong className="font-semibold text-primary">The page you&apos;re on, when you ask.</strong> It reads
                a product page only when you click its toolbar button, use its &ldquo;Add to Regibee&rdquo; menu item
                or press its shortcut. It reads the product&apos;s name, price, pictures, barcode number and the
                store&apos;s category for it. The category only helps suggest one of yours and isn&apos;t saved. You can add
                the product to a registry or save it as a gift idea, which only you can see.
              </li>
              <li>
                <strong className="font-semibold text-primary">An Elfster wishlist, when you ask.</strong> When you
                click its toolbar button on a wishlist on elfster.com, it reads that wishlist&apos;s items from
                Elfster: their names, prices, pictures, quantities, notes and the links to their shops. It compares
                them with your Regibee registry and adds the ones you pick. If you keep a list in sync with the
                wishlist, it also reads how many of each item have been bought or received on Elfster, and sends
                those counts to Regibee each time you open the wishlist there. Regibee uses them only to show
                those items as taken to your guests, and never shows them to you.
              </li>
              <li>
                <strong className="font-semibold text-primary">Store links on regibee.com.</strong> When
                you paste a link from one of those stores while adding an item, or click &ldquo;Fill them in&rdquo; on
                a list whose items are missing a photo or price, the extension may open each link in a background tab,
                read the product, and close the tab. When you open one of your lists, it also checks the prices of a
                few items whose price hasn&apos;t been checked for a week, the same way. The list shows when it&apos;s
                checking, and you can stop it.
              </li>
            </List>
            <P>
              It doesn&apos;t read any other pages or your browsing history. In your browser it keeps its own Regibee
              session, your name and email address, your list of registries, the names of the people you&apos;ve
              saved gift ideas for, and which store items you&apos;ve already seen. Disconnecting the extension removes them, and removing it from Chrome removes
              everything it kept.
            </P>
          </Section>

          <Section id="emails">
            <P>
              We send account emails, such as confirming your address, resetting your password, telling you when
              your password changed, and one welcome email when you make an account. We also send emails from
              notifications@regibee.com about things people do on Regibee:
            </P>
            <List>
              <li>
                to owners, when someone gives a gift, sends money to a fund, suggests an item, or RSVPs, either one
                at a time or in one email a day, and a few days after a list&apos;s date, with who gave what;
              </li>
              <li>
                to guests, to confirm a gift or an RSVP, to remind them before a reservation ends, to invite them to
                an event, with the host&apos;s messages and any changes to it, to remind them before the reply-by
                date and the day before, if the event is cancelled, if an item they gave or reserved is taken off a
                list, and if the list&apos;s owner cancels their reservation;
              </li>
              <li>
                to people invited to help manage a registry or co-host an event, to people someone asks to follow,
                and to people whose follow request is approved;
              </li>
              <li>
                to gift exchange members, with the name they drew, when that person adds a wishlist, and before the
                event;
              </li>
              <li>
                to followers, 10 days before the birthday of someone they follow who approved them and added a
                birthday to their gift profile;
              </li>
              <li>
                to owners who hide what&apos;s been reserved, once, the day after an event, when its gifts are
                revealed;
              </li>
              <li>
                to the person who starts a group gift, with its link and when someone chips in, and to people who
                chip in, with their own link to change it and when it&apos;s bought or called off, and to the person
                who started it when it reaches its goal;
              </li>
              <li>to the person an event is for, when its host asks them to make a gift list;</li>
              <li>
                to owners when someone links their registry to an event, or when a store&apos;s completion discount
                for their registry may be open.
              </li>
            </List>
            <P>
              You can choose how you get gift emails, and turn off follow request emails and birthday emails, on
              your Account page. You can turn off RSVP emails and the reply-by reminder for each event you host.
            </P>
            <P>
              Our email service, Resend, records when one of our emails is opened and which of its links are
              clicked. It does this with a tiny image in the email, and by sending links through its own address on
              the way to where they go. Your email app may block the image. We look at this only to check that our
              emails arrive and work, never for advertising.
            </P>
          </Section>

          <Section id="cookies">
            <List>
              <li>Sign-in cookies keep you signed in, and keep a guest&apos;s anonymous session.</li>
              <li>A cookie remembers the gifts a guest gave from that browser, for up to a year.</li>
              <li>
                When a guest opens a gift link from an event invitation, a cookie remembers who they are for up to
                60 days, so the gift form fills in their name and email, and, when everyone gives everyone, so they
                see which of the other guests reserved what.
              </li>
              <li>
                When you chip in on a group gift, a cookie remembers your pledge for up to a year, so you can change
                it from that browser.
              </li>
              <li>
                In the Regibee app, a cookie tells a regibee.com page that it&apos;s showing inside the app, so the
                page leaves out the website&apos;s top bar.
              </li>
              <li>
                There are no advertising or tracking cookies. The website runs PostHog&apos;s script to count which
                pages are opened (see{" "}
                <a href="#sharing" className={linkClass}>
                  who else handles it
                </a>
                ). It stores nothing in your browser: PostHog tells visits apart with a code made from your IP
                address and browser, which changes every day. Our fonts load from regibee.com itself.
              </li>
            </List>
            <P>The app and the extension keep the things listed in their sections above.</P>
            <P>
              Regibee doesn&apos;t follow you across other sites, and doesn&apos;t let advertising companies collect
              information about you on Regibee. If your browser sends &ldquo;Do Not Track&rdquo;, the website&apos;s
              PostHog script doesn&apos;t count your page visits.
            </P>
          </Section>

          <Section id="use">
            <P>We use your information only to run Regibee:</P>
            <List>
              <li>to show your registries, events and profile to the people you share them with;</li>
              <li>to record gifts and RSVPs, and tell the right people about them;</li>
              <li>to send the emails above;</li>
              <li>to keep accounts secure, stop abuse such as mass searches for people, and fix problems;</li>
              <li>to see which parts of Regibee people use and where they get stuck, so we can improve it.</li>
            </List>
            <P>We don&apos;t use it to build advertising profiles, and we don&apos;t sell it.</P>
          </Section>

          <Section id="sharing">
            <P>These services handle information for us, only to run Regibee:</P>
            <List>
              <li>
                <strong className="font-semibold text-primary">Supabase</strong> stores the database and uploaded
                photos, and runs sign-in.
              </li>
              <li>
                <strong className="font-semibold text-primary">Vercel</strong> hosts the website and runs its server.
              </li>
              <li>
                <strong className="font-semibold text-primary">Resend</strong> sends our emails, including the
                ones that confirm your email address and reset your password, and records whether they&apos;re
                opened and clicked.
              </li>
              <li>
                <strong className="font-semibold text-primary">Expo</strong> builds the app, delivers its updates,
                and sends its notifications through Apple and Google. Each notification goes with your phone&apos;s
                token, and holds the words you see.
              </li>
              <li>
                <strong className="font-semibold text-primary">PostHog</strong> counts how Regibee is used, and
                stores the counts in the United States. It gets events such as &ldquo;made a registry&rdquo;,
                &ldquo;added an item&rdquo;, &ldquo;gave a gift&rdquo; or &ldquo;opened a page&rdquo;, with your
                account&apos;s ID if you&apos;re signed in, the kind of device and browser, which website or app it
                came from, and which store a product came from. It never gets your name, your email, messages, what
                a registry holds, the private part of a registry&apos;s or invitation&apos;s link, or anything about
                your gift ideas. Guests&apos; gifts and RSVPs are counted without any ID that ties them to each other
                or to a person. PostHog doesn&apos;t keep IP addresses.
              </li>
            </List>
            <P>
              Like most websites, these services keep logs of requests, such as IP addresses and times, to keep
              things running and secure.
            </P>
            <P>Some things reach other sites because of how the web works:</P>
            <List>
              <li>
                When you paste a product link on regibee.com, our server opens that page to read the product.
              </li>
              <li>
                Item pictures often load from the store that hosts them, so that store sees the request when you view
                a registry.
              </li>
              <li>
                Links to stores, Venmo, PayPal, maps and calendars take you to those services, and their own privacy
                policies apply there.
              </li>
            </List>
            <P>
              We&apos;ll share information with anyone else only if you ask us to, or if the law requires it.
            </P>
          </Section>

          <Section id="your-choices">
            <List>
              <li>
                <strong className="font-semibold text-primary">See and change.</strong> Edit your registries, items,
                funds, events and gift ideas wherever you see them on your dashboard. Change your name and how people can find
                you on your{" "}
                <Link href="/dashboard/account" className={linkClass}>
                  Account page
                </Link>
                .
              </li>
              <li>
                <strong className="font-semibold text-primary">Delete.</strong> Delete items, registries, events and
                gift ideas whenever you like. Delete your whole account on your{" "}
                <Link href="/dashboard/account" className={linkClass}>
                  Account page
                </Link>
                , or on the Account tab in the app. That deletes your sign-in and profile, your follows, follow
                requests and blocks, your groups, your gift ideas, your phones&apos; notification tokens, the events you made with their guest lists and RSVPs, and what PostHog counted under your account&apos;s ID. It signs you out of
                the website, the app and the extension.
              </li>
              <li>
                <strong className="font-semibold text-primary">Your registries when you delete your account.</strong>{" "}
                A registry only you manage is deleted with its items, funds, photos, suggestions and the gifts
                guests gave on it. A registry you share goes to the person who joined first in helping you manage
                it, with everything on it. Registries you only help manage stay with their owner, and you lose access.
              </li>
              <li>
                <strong className="font-semibold text-primary">Gifts and RSVPs.</strong> These stay with the registry
                or event they were for, and a gift is deleted when the owner deletes the item or cash fund it was
                for. They aren&apos;t tied to an account, even if you have one, because we only have the name and
                email you typed. To have yours removed, ask the owner, or email us.
              </li>
              <li>
                <strong className="font-semibold text-primary">Anything else.</strong> Email us at <ContactEmail /> for
                a copy of your information, or for anything you can&apos;t do yourself. We&apos;ll reply within 30
                days.
              </li>
            </List>
            <P>
              Depending on where you live, the law may give you more rights over your information, such as getting
              a copy of it, correcting it, deleting it or objecting to how it&apos;s used. You can use any of them by
              emailing us, and we won&apos;t treat you differently for doing so.
            </P>
          </Section>

          <Section id="keeping">
            <P>
              We keep your information until you delete it or your account. Gifts, suggestions and RSVPs stay with
              the registry or event they were for until its owner deletes it. A gift goes sooner if the owner deletes
              the item or cash fund it was for. A group gift and the pledges on it stay until the registry is deleted
              or the person who started it deletes their account, and so does its reservation of the item, even if
              the owner deletes the item. We keep a note of
              each birthday email we send for 60 days, so the same one is never sent twice. Deleted information can
              stay in our
              providers&apos; backups, and records of emails already sent can stay in our email service&apos;s logs,
              until they expire on those providers&apos; own schedules. Usage counts stay in PostHog until its
              plan&apos;s retention period removes them, and those under your account&apos;s ID are deleted with
              your account.
            </P>
          </Section>

          <Section id="security">
            <P>
              Every connection to Regibee is encrypted. Access rules in the database let each person reach only what
              they&apos;re allowed to. Guest lists, gift exchanges, groups, group gifts, follows, blocks and the
              notes of birthday emails sent can be read only by our server. Our support team can access the
              information in your account, including private registries and gift ideas, when they need to help with
              a problem. No system
              is perfectly secure, so if you find a problem, please email us at <ContactEmail />.
            </P>
          </Section>

          <Section id="children">
            <P>
              Regibee is for adults planning gifts and events, and isn&apos;t meant for children. Please don&apos;t
              use it if you&apos;re under 13. A registry may mention a child, such as a baby&apos;s name, or a
              child&apos;s sizes and birthday on a list kept for them, and you decide what to put there. If you think a child has given us their information, email us and we&apos;ll
              delete it.
            </P>
          </Section>

          <Section id="changes">
            <P>
              When we change this policy, we&apos;ll update the date at the top. If a change affects how we use
              information you&apos;ve already given us, we&apos;ll tell account holders by email or on the site
              first.
            </P>
          </Section>

          <Section id="contact">
            <P>
              Regibee is run from {PRIVACY_FACTS.location}. Questions and requests about your information go to{" "}
              <ContactEmail />.
            </P>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
