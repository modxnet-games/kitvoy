import { Play } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { LandingHeading } from "./landing-heading";

export function UgcVideoGrid() {
  const { ugc } = landingConfig;
  const videos = ugc.videos.filter((v) => v.videoSrc);
  // Hidden until real customer clips are added in config/landing.ts
  if (videos.length === 0) return null;

  return (
    <section className="py-16 md:py-28">
      <div className="container mx-auto px-4">
        <LandingHeading eyebrow={ugc.eyebrow} title={ugc.title} subtitle={ugc.subtitle} />
      </div>

      {/* Mobile: swipeable row. md+: staggered grid */}
      <div className="container mx-auto mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mt-14 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
        {videos.map((video, i) => (
          <figure
            key={video.caption}
            data-reveal
            className={`group relative aspect-[9/16] w-[62vw] max-w-[260px] shrink-0 snap-center overflow-hidden rounded-3xl md:w-auto md:max-w-none bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-lg ring-1 ring-black/5 ${i % 3 === 1 ? "md:translate-y-10" : ""}`}
          >
            {video.videoSrc ? (
              <video
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                src={video.videoSrc}
                poster={video.poster || undefined}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,122,26,0.25),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative flex size-16 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition-transform duration-500 group-hover:scale-110">
                  <Play className="ml-1 size-6 fill-current" />
                </span>
              </div>
            )}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12 text-xs font-semibold text-white sm:text-sm">
              {video.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
