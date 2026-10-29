"use client";

import { Printer } from "lucide-react";

interface PrintOrderButtonProps {
  orderId: string;
}

export function PrintOrderButton({ orderId }: PrintOrderButtonProps) {
  const href = `/admin/orders/${orderId}/print`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        console.log("[print] button click orderId:", orderId);
      }}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-primary bg-transparent px-4 text-sm font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
    >
      <Printer className="size-4" />
      Print PDF
    </a>
  );
}
