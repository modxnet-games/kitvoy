import type { DiagramId } from "@/config/products/types";

const FOREST = "#1C5244";
const SAGE = "#79A180";
const ACCENT = "#CFE3D2";
const IVORY = "#FBF8F1";
// Darker than the page's muted text: it sits on the sofa's tint
const LABEL = "#46554E";

/**
 * PouncePop, seen from above: a nudge wakes the ball (1), it rolls across the
 * floor, meets the sofa and reverses (2), then rests on standby until the next
 * touch (3). A schematic of the owner's spec (wake at a touch, obstacle
 * avoidance, standby), not a measured path.
 */
function PouncePopMotion() {
  const number = { textAnchor: "middle" as const, fontSize: 13, fontFamily: "Georgia, serif", fill: FOREST };
  const trail = { fill: "none", stroke: SAGE, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeDasharray: "0.1 7" };
  const head = { fill: "none", stroke: SAGE, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 320 320" role="img" aria-label="Diagram, seen from above: a nudge wakes the ball, it rolls across the floor, meets the sofa and reverses, then rests until the next touch">
      <defs>
        <radialGradient id="kv-diagram-glow" cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor={ACCENT} stopOpacity=".95" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The floor */}
      <rect x="16" y="16" width="288" height="288" rx="20" fill={IVORY} stroke="#E6E0D2" strokeWidth="2" />
      <path d="M17 112H303M17 208H303" stroke="#EFE9DB" strokeWidth="1.5" />

      {/* The sofa */}
      <rect x="212" y="52" width="76" height="156" rx="16" fill="#EAE4D5" stroke="#CFC7B4" strokeWidth="2" />
      <rect x="226" y="66" width="48" height="128" rx="10" fill="none" stroke="#CFC7B4" strokeWidth="1.5" />
      <text x="250" y="134" textAnchor="middle" fontSize="10.5" fill={LABEL} fontFamily="sans-serif" letterSpacing="1.5">SOFA</text>

      {/* 1: a nudge wakes it */}
      <circle cx="66" cy="244" r="12" fill="none" stroke={SAGE} strokeWidth="2" strokeDasharray="3 4" />
      <text x="66" y="278" {...number}>1</text>

      {/* It rolls toward the sofa */}
      <path d="M81 238C122 228 156 200 180 164" {...trail} />
      <path d="M170.500 166.500L181 162.500 181.500 174" {...head} />

      {/* 2: it meets the sofa and reverses */}
      <circle cx="197" cy="142" r="12" fill="none" stroke={SAGE} strokeWidth="2" strokeDasharray="3 4" />
      <path d="M214 126l6-4M216 142h8M214 158l6 4" stroke={FOREST} strokeWidth="2" strokeLinecap="round" />
      <text x="197" y="116" {...number}>2</text>

      {/* Back across the floor */}
      <path d="M183 136C160 108 140 92 116 86" {...trail} />
      <path d="M124 80L113.500 85.500 121.500 94" {...head} />

      {/* 3: it rests, its ring still glowing, until the next touch */}
      <circle cx="86" cy="84" r="36" fill="url(#kv-diagram-glow)" />
      <circle cx="86" cy="84" r="15" fill={FOREST} />
      <circle cx="86" cy="84" r="6.5" fill="none" stroke={ACCENT} strokeWidth="2" />
      <text x="86" y="128" {...number}>3</text>
    </svg>
  );
}

/** The schematic a product page shows beside its three steps. */
export function ProductDiagram({ id }: { id: DiagramId }) {
  if (id === "pouncepop-motion") return <PouncePopMotion />;
  return null;
}
