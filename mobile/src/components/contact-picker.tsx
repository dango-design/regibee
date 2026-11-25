// "Add from contacts" for the guest list and a group's people: opens the
// phone's contact picker, and when the contact has more than one email
// address, a sheet to choose one. The screen gets a name and an email (or "")
// to put in its form, where the person checks it and taps Add.

import { useState } from "react";
import { Platform } from "react-native";

import { ChoiceSheet } from "@/components/choice-sheet";
import { pickContact, type PickedContact } from "@/lib/contacts";
import { errorMessage } from "@/lib/data";

/** The web preview has no contacts. */
export const CAN_PICK_CONTACTS = Platform.OS !== "web";

export function useContactPicker(onPicked: (name: string, email: string) => void, onError: (message: string) => void) {
  // Stays set while the sheet slides away, so the sheet keeps its text.
  const [contact, setContact] = useState<PickedContact | null>(null);
  const [choosing, setChoosing] = useState(false);

  async function open() {
    let picked: PickedContact | null;
    try {
      picked = await pickContact();
    } catch (e) {
      onError(errorMessage(e));
      return;
    }
    if (!picked) return;
    if (picked.emails.length > 1) {
      setContact(picked);
      setChoosing(true);
    } else {
      onPicked(picked.name, picked.emails[0] ?? "");
    }
  }

  const sheet = (
    <ChoiceSheet
      visible={choosing}
      onClose={() => setChoosing(false)}
      title={contact?.name ? `Which email for ${contact.name}?` : "Which email?"}
      choices={contact ? contact.emails.map((email) => ({ key: email, label: email, onPress: () => onPicked(contact.name, email) })) : []}
    />
  );

  return { open, sheet };
}
