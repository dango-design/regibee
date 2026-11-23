import { notFound } from "next/navigation";
import { SupportAccountView } from "@/components/support/support-account";
import { loadAccountForSupport, recordSupportView, requireSupport } from "@/lib/support";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SupportAccountPage({ params }: { params: Promise<{ userId: string }> }) {
  const support = await requireSupport();
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();

  const account = await loadAccountForSupport(userId);
  if (!account) notFound();

  // Recorded before anything is shown. If it can't be saved, the page fails.
  await recordSupportView({ supportUserId: support.id, what: "account", accountId: account.id });
  return <SupportAccountView account={account} />;
}
