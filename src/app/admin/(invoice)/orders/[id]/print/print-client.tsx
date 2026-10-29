"use client";

import { useEffect } from "react";

/**
 * Floating toolbar with Print + Back buttons (hidden when printing).
 * Auto-triggers print dialog only after data is rendered.
 */
export function OrderPrintClient({ orderId }: { orderId: string }) {
  useEffect(() => {
    let timer: number | null = null;
    let attempts = 0;

    const triggerWhenReady = () => {
      const nameEl = document.querySelector(".ship-to .name");
      const hasRenderedData = Boolean(nameEl?.textContent?.trim());

      if (hasRenderedData) {
        window.print();
        return;
      }

      if (attempts >= 80) {
        console.warn("[print] invoice render timeout; print not triggered", {
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
    <div
      className="no-print"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 100,
        display: "flex",
        gap: 8,
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
        🖨️ Print / Save PDF
      </button>
      <button
        type="button"
        onClick={() => window.history.back()}
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
        ← Back
      </button>
    </div>
  );
}
