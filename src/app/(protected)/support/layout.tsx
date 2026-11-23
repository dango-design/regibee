import type { Metadata } from "next";
import { requireSupport } from "@/lib/support";

// The support team's pages. See "Support view" in CLAUDE.md. Each page also
// checks on its own, since a layout doesn't run again on every navigation.
export const metadata: Metadata = { title: "Support | Regibee", robots: { index: false, follow: false } };

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  await requireSupport();
  return children;
}
