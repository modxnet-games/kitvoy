export type TrustIconName = "cash" | "truck" | "exchange" | "support";

/** The trust row's stroke icons. */
export function TrustIcon({ name, size = 22 }: { name: TrustIconName; size?: number }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === "cash" && (<><rect {...p} x="2.5" y="6.5" width="19" height="11" rx="2" /><circle {...p} cx="12" cy="12" r="2.6" /><path {...p} d="M6 9.5v5M18 9.5v5" /></>)}
      {name === "truck" && (<><path {...p} d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle {...p} cx="7" cy="17.5" r="1.7" /><circle {...p} cx="17" cy="17.5" r="1.7" /></>)}
      {name === "exchange" && (<><path {...p} d="M4 9h13.5M14 5.5L17.5 9 14 12.5" /><path {...p} d="M20 15H6.5M10 11.5L6.5 15l3.5 3.5" /></>)}
      {name === "support" && (<><path {...p} d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path {...p} d="M9 12l2.2 2.2L15.2 10" /></>)}
    </svg>
  );
}

/** The payment promise, where a card store shows its card logos: pay the courier in cash. */
export function CodBadge({ title, sub, className = "" }: { title: string; sub?: string; className?: string }) {
  return (
    <div className={`kv-cod ${className}`.trim()}>
      <span className="kv-cod-ic">
        <TrustIcon name="cash" size={22} />
      </span>
      <span className="kv-cod-text">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}
