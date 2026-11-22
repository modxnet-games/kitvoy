"use client";

import { useEffect } from "react";

/**
 * The Print and Close buttons above the slip (hidden when printing).
 * Opens the print dialog by itself once the slip and its logo are on the page.
 */
export function OrderPrintClient({ orderId }: { orderId: string }) {
  useEffect(() => {
    let timer: number | null = null;
    let attempts = 0;

    const triggerWhenReady = () => {
      const nameEl = document.querySelector(".ship-to .name");
      const hasRenderedData = Boolean(nameEl?.textContent?.trim());
      // A logo still loading would print as an empty box (a logo that failed to load counts as done)
      const imagesDone = Array.from(document.images).every((img) => img.complete);

      if (hasRenderedData && imagesDone) {
        window.print();
        return;
      }

      if (attempts >= 80) {
        console.warn("[print] delivery slip not ready in time; print not triggered", {
          orderId,
          attempts,
        });
        return;
      }

      attempts += 1;
      timer = window.setTimeout(triggerWhenReady, 150);
    };

    timer = window.setTimeout(triggerWhenReady, 50);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId]);

  return (
    // Above the slip rather than floating over it: on a phone a floating bar hides the slip's heading
    <div
      className="no-print"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        padding: "12px 16px",
      }}
    >
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          padding: "8px 20px",
          fontSize: 13,
          fontWeight: 700,
          background: "#222",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Print / Save PDF
      </button>
      <button
        type="button"
        onClick={() => {
          // The slip opens in its own tab: with nothing to go back to, the tab closes
          if (window.history.length > 1) window.history.back();
          else window.close();
        }}
        style={{
          padding: "8px 20px",
          fontSize: 13,
          fontWeight: 600,
          background: "#fff",
          color: "#222",
          border: "1px solid #ccc",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  );
}
