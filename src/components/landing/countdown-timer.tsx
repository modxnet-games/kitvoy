"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  label: string;
  /** ISO date string. Empty = count down to local midnight. */
  endsAt?: string;
  className?: string;
}

function getDeadline(endsAt?: string): number {
  if (endsAt) {
    const parsed = Date.parse(endsAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function CountdownTimer({ label, endsAt, className }: CountdownTimerProps) {
  // null until mounted so server and client render the same markup
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadline = getDeadline(endsAt);
    const tick = () => setRemaining(deadline - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (remaining !== null && remaining <= 0) return null;

  const parts = remaining === null ? null : splitRemaining(remaining);
  const units: [string, number | undefined][] = [
    ["Hrs", parts?.hours],
    ["Min", parts?.minutes],
    ["Sec", parts?.seconds],
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
        className,
      )}
      role="timer"
      aria-live="off"
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
        <Clock className="size-4" />
        {label}
      </span>
      <div className="flex items-center gap-1.5 font-mono tabular-nums">
        {units.map(([unit, value], i) => (
          <span key={unit} className="flex items-center gap-1.5">
            {i > 0 && <span className="font-bold">:</span>}
            <span className="flex flex-col items-center rounded-md bg-red-600 px-2 py-1 text-white">
              <span className="text-lg font-bold leading-none">
                {value === undefined ? "--" : pad(value)}
              </span>
              <span className="text-[10px] uppercase leading-tight opacity-80">{unit}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
