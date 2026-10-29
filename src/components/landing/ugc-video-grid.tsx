import { Play } from "lucide-react";

import { landingConfig } from "@/config/landing";

export function UgcVideoGrid() {
  const { ugc } = landingConfig;

  return (
    <section className="container mx-auto px-4 py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 data-reveal className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
          {ugc.title}
        </h2>
        <p data-reveal className="mt-4 text-muted-foreground">{ugc.subtitle}</p>
      </div>

      <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {ugc.videos.map((video, i) => (
          <figure
            key={video.caption}
            data-reveal
            className={`group relative aspect-[9/16] overflow-hidden rounded-3xl bg-gradient-to-b from-slate-800 to-slate-950 shadow-lg ring-1 ring-black/5 ${i % 3 === 1 ? "md:translate-y-10" : ""}`}
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
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(249,115,22,0.25),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
