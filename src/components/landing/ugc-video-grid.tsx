import { Play } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { SectionHeading } from "@/components/storefront";

export function UgcVideoGrid() {
  const { ugc } = landingConfig;

  return (
    <section className="container mx-auto px-4 py-12 md:py-20">
      <SectionHeading title={ugc.title} subtitle={ugc.subtitle} className="text-center sm:justify-center" />

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {ugc.videos.map((video) => (
          <figure
            key={video.caption}
            className="group relative aspect-[9/16] overflow-hidden rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 shadow-md"
          >
            {video.videoSrc ? (
              <video
                className="size-full object-cover"
                src={video.videoSrc}
                poster={video.poster || undefined}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition group-hover:scale-110">
                  <Play className="ml-1 size-6 fill-current" />
                </span>
              </div>
            )}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-xs font-medium text-white sm:text-sm">
              {video.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
