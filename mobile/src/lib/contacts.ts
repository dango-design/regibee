// Picking one person from the phone's contacts, to add as an event guest or a
// group member. Only the name and email addresses of the contact the person
// picks are read, and nothing is sent anywhere until they tap Add.
//
// This uses the older picker in expo-contacts/legacy on purpose. On iPhone it
// hands back the picked contact straight from Apple's picker, which needs no
// permission. The newer Contact.presentPicker() only returns the contact's id,
// and reading its email then asks for access to every contact.
//
// Android has no picker like Apple's: the app reads the picked contact from
// the contacts database, which needs the contacts permission. So Android asks
// for it first.

import * as Contacts from "expo-contacts/legacy";
import { Alert, Linking, Platform } from "react-native";

export interface PickedContact {
  name: string;
  /** Each different address on the contact, primary first. */
  emails: string[];
}

async function allowedOnAndroid(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const permission = await Contacts.requestPermissionsAsync();
  if (permission.granted) return true;
  Alert.alert(
    "Regibee can't open your contacts",
    "To add someone from your contacts, allow Regibee to read them in Settings. Regibee only reads the person you pick.",
    permission.canAskAgain
      ? [{ text: "OK" }]
      : [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]
  );
  return false;
}

/** Opens the phone's contact picker. Null when the person cancels. */
export async function pickContact(): Promise<PickedContact | null> {
  if (!(await allowedOnAndroid())) return null;
  const contact = await Contacts.presentContactPickerAsync();
  if (!contact) return null;

  const name =
    contact.name?.trim() ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() ||
    contact.company?.trim() ||
    "";
  const emails: string[] = [];
  const sorted = [...(contact.emails ?? [])].sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));
  for (const entry of sorted) {
    const email = entry.email?.trim();
    if (email && !emails.some((e) => e.toLowerCase() === email.toLowerCase())) emails.push(email);
  }
  return { name, emails };
}
