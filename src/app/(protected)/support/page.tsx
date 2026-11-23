import { SupportSearch } from "@/components/support/support-search";
import { requireSupport, searchForSupport } from "@/lib/support";

export default async function SupportSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSupport();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const results = query ? await searchForSupport(query) : null;
  return <SupportSearch query={query} results={results} />;
}
