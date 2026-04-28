"use client";

import { useState } from "react";
import { StockAnalysisPanel } from "./StockAnalysisPanel";

export function TickerSymbol({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const clean = symbol.trim().toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "font-sans underline-offset-2 hover:underline"}
      >
        {clean}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-(--card-border) bg-(--card) p-4 font-sans text-foreground shadow-xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
              >
                X
              </button>
            </div>
            <StockAnalysisPanel symbol={clean} />
          </div>
        </div>
      )}
    </>
  );
}
