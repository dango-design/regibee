import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChecklistManager } from "@/components/checklist-manager";
import { loadChecklistPage } from "@/lib/checklist-page";
import { getSessionUser } from "@/lib/viewer";

export const metadata: Metadata = { title: "Checklist | Regibee" };

export default async function ChecklistPage({ params }: { params: Promise<{ registryId: string }> }) {
  const { registryId } = await params;
  if (!(await getSessionUser())) redirect("/login");

  // The phone app loads the same data (src/lib/checklist-page.ts). Only baby
  // registries have a checklist.
  const data = await loadChecklistPage(registryId);
  if (!data) notFound();

  return <ChecklistManager data={data} />;
}
