import { ProfileAvatar } from "@/components/profile-avatar";
import type { DashboardManager } from "@/lib/dashboard-page-types";
import { cx } from "@/lib/utils/cx";

/** Up to this many faces, then "+2". */
const MAX_FACES = 3;

/** "Ana", "Ana and Ben", "Ana, Ben and Cy". */
export function managerNames(managers: DashboardManager[]): string {
  const names = managers.map((manager) => manager.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The other people who manage a list, as a row of overlapping faces. It shows
 * on a list's card on the My registries tab and in the reorder list, so a
 * list you share with someone is easy to spot. Shows nothing when only you
 * manage the list.
 */
export function ManagerAvatars({ managers, className }: { managers: DashboardManager[]; className?: string }) {
  if (managers.length === 0) return null;
  const faces = managers.slice(0, MAX_FACES);
  const more = managers.length - faces.length;
  const label = `Shared with ${managerNames(managers)}`;

  return (
    <span className={cx("inline-flex items-center", className)} title={label}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="flex -space-x-2">
        {faces.map((manager, index) => (
          <ProfileAvatar
            key={index}
            name={manager.name}
            photoUrl={manager.photoUrl}
            className="ring-2 ring-bg-primary"
            fallbackClassName="bg-brand-secondary text-xs font-semibold text-brand-secondary"
          />
        ))}
        {more > 0 && (
          <span className="relative flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary ring-2 ring-bg-primary">
            +{more}
          </span>
        )}
      </span>
    </span>
  );
}
