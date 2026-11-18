import { PencilLine } from "lucide-react";
import type { Correction } from "@/lib/tutor";
import { cn } from "@/lib/utils";

/** Tarjeta amarilla con las correcciones: original tachado, versión correcta y explicación */
export function CorrectionCard({ corrections, className }: { corrections: Correction[]; className?: string }) {
  return (
    <div
      role="note"
      aria-label="Corrección"
      className={cn(
        "rounded-2xl border border-amber-400/50 bg-amber-50/90 p-3 text-sm duration-500 animate-in fade-in zoom-in-95 dark:bg-amber-400/10",
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        <PencilLine className="h-3.5 w-3.5" /> Corrección
      </p>
      <ul className="space-y-2.5">
        {corrections.map((c, i) => (
          <li key={i}>
            <p className="text-red-600 line-through decoration-red-400/70 dark:text-red-400">{c.original}</p>
            <p className="font-medium text-emerald-700 dark:text-emerald-400">✓ {c.corrected}</p>
            {c.explanation && <p className="mt-0.5 text-muted-foreground">{c.explanation}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
