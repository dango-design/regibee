import { cn } from "@/lib/utils";

type TagVariant = "most-wanted" | "guest-purchased" | "parent-purchased" | "gifted" | "purchased-by-you" | "reserved";

const variantStyles: Record<TagVariant, string> = {
  "most-wanted": "bg-sunshine-400 border-sunshine-400 text-gray-900",
  "guest-purchased": "bg-sunshine-100 dark:bg-sunshine-400/15 border-sunshine-100 dark:border-sunshine-900 text-primary",
  "parent-purchased": "bg-primary border-sunshine-400 text-primary",
  "gifted": "bg-mint-500 border-mint-500 text-gray-900",
  "purchased-by-you": "bg-transparent border-mint-500 text-primary",
  // A guest is holding the item while they buy it.
  "reserved": "bg-sunshine-50 dark:bg-sunshine-400/10 border-sunshine-200 dark:border-sunshine-900 text-primary",
};

interface TagProps {
  variant: TagVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function Tag({ variant, children, className, onClick }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        variantStyles[variant],
        className
      )}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
