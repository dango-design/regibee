import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

// What a /r/ link shows when it doesn't open a list: a typo, a deleted list,
// or a link its owner turned off by getting a new one. It says the same for
// all three, so it never tells anyone a list exists.
export default function ListNotFound() {
  return (
    <div className="min-h-screen bg-primary">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-display-xs font-semibold text-primary">This link doesn&apos;t open a list</h1>
        <p className="mt-3 text-tertiary">
          It may have a typo, or the list may be gone. Its owner may also have turned this link off and made a new
          one. Ask the person who sent it to you for the current link.
        </p>
        <Button asChild className="mt-6 max-sm:w-full">
          <Link href="/">Go to Regibee</Link>
        </Button>
      </main>
    </div>
  );
}
