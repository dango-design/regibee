import { SavedViews } from "@/components/saved-views";

// The Saved tab has two views, For me and Gift ideas. The switch between them
// stays on screen while either one loads.
export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SavedViews />
      {children}
    </>
  );
}
