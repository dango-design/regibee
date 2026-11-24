"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsFor } from "@/lib/initials";
import { cx } from "@/lib/utils/cx";

/**
 * A person's profile photo in a circle, or the initials of their name when
 * they have none, or when the photo doesn't load.
 */
export function ProfileAvatar({
  name,
  photoUrl,
  size,
  className,
  fallbackClassName,
}: {
  name: string;
  photoUrl?: string | null;
  size?: React.ComponentProps<typeof Avatar>["size"];
  className?: string;
  fallbackClassName?: string;
}) {
  // Remembers which photo failed, so a new one gets its own try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(photoUrl) && photoUrl !== failedUrl;

  return (
    <Avatar size={size} className={className}>
      {showPhoto ? (
        // The name is always next to it, so the photo needs no alt text of its own.
        <img
          src={photoUrl!}
          alt=""
          className="size-full bg-secondary object-cover"
          onError={() => setFailedUrl(photoUrl ?? null)}
        />
      ) : (
        <AvatarFallback className={cx("font-medium", fallbackClassName)}>{initialsFor(name)}</AvatarFallback>
      )}
    </Avatar>
  );
}
