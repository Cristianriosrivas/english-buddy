"use client";

import { Mic, MicOff, PhoneOff } from "lucide-react";
import { TUTOR_NAME } from "@/lib/chat";
import type { LiveCall, LivePhase } from "@/lib/live-call";
import { cn } from "@/lib/utils";

const STATUS: Record<LivePhase, string> = {
  idle: "",
  connecting: "Conectando…",
  listening: "Te escucho… habla en inglés",
  transcribing: "Entendiendo lo que dijiste…",
  thinking: `${TUTOR_NAME} está pensando…`,
  speaking: `${TUTOR_NAME} está hablando`,
  paused: "Micrófono en pausa",
  ended: "Llamada terminada",
};

/** Pantalla de llamada en vivo con la agente */
export function LiveCallOverlay({ live, level, onHangUp }: { live: LiveCall; level: string; onHangUp: () => void }) {
  const { phase } = live;
  const busy = phase === "transcribing" || phase === "thinking" || phase === "connecting";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Llamada con ${TUTOR_NAME}`}
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-violet-950 via-indigo-950 to-slate-950 text-white duration-300 animate-in fade-in"
    >
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <p className="font-semibold">Llamada con {TUTOR_NAME}</p>
          <p className="text-xs text-white/60">Nivel {level} · habla en inglés, te responde por voz</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 text-center">
        <button
          type="button"
          onClick={phase === "speaking" ? live.interrupt : phase === "paused" ? live.togglePause : undefined}
          aria-label={phase === "speaking" ? `Interrumpir a ${TUTOR_NAME}` : TUTOR_NAME}
          className="relative grid h-48 w-48 shrink-0 place-items-center"
        >
          {/* Anillo que crece con tu voz */}
          <span
            aria-hidden
            className="absolute inset-4 rounded-full bg-sky-400/25 transition-transform duration-100"
            style={{ transform: `scale(${1 + live.level * 0.5})` }}
          />
          {phase === "speaking" && (
            <span aria-hidden className="absolute inset-6 animate-ping rounded-full bg-violet-400/30" />
          )}
          {busy && (
            <span
              aria-hidden
              className="absolute inset-2 animate-spin rounded-full border-4 border-white/10 border-t-sky-300"
            />
          )}
          <span
            className={cn(
              "relative grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-5xl font-bold shadow-2xl shadow-violet-500/40 transition-transform duration-300",
              phase === "speaking" && "scale-105",
              phase === "paused" && "opacity-60 grayscale",
            )}
          >
            {TUTOR_NAME[0]}
          </span>
        </button>

        <div aria-live="polite" className="flex flex-col items-center gap-1">
          <p className="text-lg font-medium">{STATUS[phase]}</p>
          {phase === "speaking" && <p className="text-xs text-white/60">Toca a {TUTOR_NAME} para interrumpirla</p>}
        </div>

        <div className="flex w-full max-w-md flex-col gap-3">
          {live.userText && (
            <p className="rounded-2xl bg-white/10 px-4 py-2 text-sm text-white/80">
              <span className="font-semibold text-sky-300">Tú: </span>
              {live.userText}
            </p>
          )}
          {live.replyText && (
            <p className="rounded-2xl bg-violet-500/20 px-4 py-2 text-left text-base leading-relaxed">
              <span className="font-semibold text-violet-200">{TUTOR_NAME}: </span>
              {live.replyText}
            </p>
          )}
          {live.corrections.slice(0, 2).map((c, i) => (
            <div key={i} className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-left text-sm">
              <p>
                <span className="text-red-300 line-through decoration-red-300/70">{c.original}</span>
                <span className="mx-1.5 text-white/50">→</span>
                <span className="font-medium text-emerald-300">{c.corrected}</span>
              </p>
              {c.explanation && <p className="mt-0.5 text-xs text-white/60">{c.explanation}</p>}
            </div>
          ))}
          {live.error && (
            <p role="alert" className="text-sm text-amber-300">
              {live.error}
            </p>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-center gap-10 px-6 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={live.togglePause}
          disabled={phase !== "listening" && phase !== "paused"}
          aria-label={phase === "paused" ? "Seguir hablando" : "Pausar el micrófono"}
          className="grid h-14 w-14 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {phase === "paused" ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
        <button
          type="button"
          onClick={onHangUp}
          aria-label="Colgar"
          className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lg shadow-red-500/40 transition-transform hover:scale-105 active:scale-95"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </footer>
    </div>
  );
}
