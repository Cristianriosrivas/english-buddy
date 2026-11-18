"use client";

import { RotateCcw } from "lucide-react";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground shadow-lg shadow-primary/30"
    >
      <RotateCcw className="h-4 w-4" /> Reintentar
    </button>
  );
}
