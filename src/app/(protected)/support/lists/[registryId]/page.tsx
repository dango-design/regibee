import { notFound } from "next/navigation";
import { SupportListView } from "@/components/support/support-list";
import { loadListPageForSupport } from "@/lib/list-page";
import { loadListFactsForSupport, recordSupportView, requireSupport } from "@/lib/support";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SupportListPage({
  params,
  searchParams,
}: {
  params: Promise<{ registryId: string }>;
  searchParams: Promise<{ gifts?: string }>;
}) {
  const support = await requireSupport();
  const [{ registryId }, { gifts }] = await Promise.all([params, searchParams]);
  if (!UUID.test(registryId)) notFound();
  const showHiddenGifts = gifts === "shown";

  // The owner's own view of the list, from the loader their manage page uses
  // (src/lib/list-page.ts).
  const loaded = await loadListPageForSupport(registryId, { showHiddenGifts });
  if (!loaded) notFound();
  const { page, ownerHidesGifts } = loaded;
  const facts = await loadListFactsForSupport(registryId, page.registry.owner_id);
  if (!facts) notFound();

  // Recorded before anything is shown. If it can't be saved, the page fails.
  await recordSupportView({
    supportUserId: support.id,
    what: showHiddenGifts ? "hidden_gifts" : "list",
    accountId: page.registry.owner_id,
    registryId,
  });

  return (
    <SupportListView page={page} facts={facts} showHiddenGifts={showHiddenGifts} ownerHidesGifts={ownerHidesGifts} />
  );
}
