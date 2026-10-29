import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Text wordmark used in the header and footer. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-2xl font-black tracking-tight",
        className,
      )}
    >
      <img src={siteConfig.icon} alt="" aria-hidden className="size-8" />
      {siteConfig.name}
    </span>
  );
}
