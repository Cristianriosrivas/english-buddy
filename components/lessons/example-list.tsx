"use client";

import { Square, Volume2 } from "lucide-react";
import { useSpeechSynthesis } from "@/lib/speech";
import { speechRateFor } from "@/lib/levels";
import type { LessonExample } from "@/lib/lessons";
import { cn } from "@/lib/utils";

/** Ejemplos en inglés con su traducción y botón para escucharlos */
export function ExampleList({ examples, level }: { examples: LessonExample[]; level: string }) {
  const tts = useSpeechSynthesis({ rate: speechRateFor(level) });

  return (
    <ul className="grid gap-2">
      {examples.map((example, i) => {
        const id = `example-${i}`;
        const speaking = tts.speakingId === id;
        return (
          <li key={id} className={cn("glass flex items-start gap-3 rounded-2xl p-3", speaking && "border-primary/50")}>
            {tts.supported && (
              <button
                type="button"
                onClick={() => (speaking ? tts.stop() : tts.speak(example.en, id))}
                aria-label={speaking ? "Detener" : `Escuchar: ${example.en}`}
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors",
                  speaking ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20",
                )}
              >
                {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}
            <div className="min-w-0">
              <p className="font-medium">{example.en}</p>
              <p className="text-sm text-muted-foreground">{example.es}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
