import { redirect } from "next/navigation";
import { CreateRegistryForm } from "@/components/create-registry-form";
import { LIST_OCCASIONS, type ListOccasion } from "@/lib/occasions";
import type { RegistryType } from "@/lib/types";
import { getSessionUser } from "@/lib/viewer";

export default async function NewRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; occasion?: string }>;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // The New page's gift lists link here with the type, and the occasion for a
  // personal list, already chosen.
  const { type, occasion } = await searchParams;
  const startType: RegistryType | undefined = type === "baby" || type === "personal" ? type : undefined;
  const startOccasion =
    startType === "personal" && (LIST_OCCASIONS as readonly string[]).includes(occasion ?? "")
      ? (occasion as ListOccasion)
      : undefined;

  // Guests have anonymous sessions and no profile page.
  return (
    <CreateRegistryForm canListOnProfile={!user.is_anonymous} startType={startType} startOccasion={startOccasion} />
  );
}
