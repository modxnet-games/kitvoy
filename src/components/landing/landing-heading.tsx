import { cn } from "@/lib/utils";

interface LandingHeadingProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** "dark" for headings on the espresso sections */
  tone?: "light" | "dark";
  className?: string;
}

/** Section heading used across the landing page: eyebrow, title, optional subtitle. */
export function LandingHeading({ eyebrow, title, subtitle, tone = "light", className }: LandingHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p
        data-reveal
        className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.26em] text-brand"
      >
        <span className="h-px w-6 bg-brand/60" aria-hidden />
        {eyebrow}
        <span className="h-px w-6 bg-brand/60" aria-hidden />
      </p>
      <h2
        data-reveal
        className={cn(
          "mt-4 text-balance text-[2rem] font-black leading-[1.05] tracking-tight sm:text-5xl",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          data-reveal
          className={cn(
            "mx-auto mt-4 max-w-xl text-[15px] leading-relaxed sm:text-base",
            dark ? "text-zinc-400" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
