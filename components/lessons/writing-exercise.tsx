"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { WritingGrade } from "@/lib/tutor";
import { CorrectionCard } from "@/components/chat/correction-card";
import { cn } from "@/lib/utils";

const MAX_CHARS = 1200;

/** Ejercicio de escritura: la IA lo califica de 1 a 10 y explica cómo mejorar */
export function WritingExercise({
  lessonId,
  prompt,
  lastScore,
}: {
  lessonId: string;
  prompt: string;
  lastScore: number | null;
}) {
  const [text, setText] = useState("");
  const [grade, setGrade] = useState<WritingGrade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (sending || text.trim().length < 15) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/lesson-writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, text }),
      });
      const data = await res.json().catch(() => ({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }));
      if (!res.ok || !data.grade) throw new Error(data.error ?? "No pude corregir tu texto.");
      setGrade(data.grade);
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No hay conexión. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="glass rounded-2xl p-4">{prompt}</p>
      {lastScore !== null && !grade && (
        <p className="text-sm text-muted-foreground">Tu última nota: {lastScore}/10</p>
      )}

      <label className="glass block rounded-2xl p-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="sr-only">Tu texto en inglés</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHARS}
          rows={5}
          placeholder="Write in English…"
          className="w-full resize-y bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <span className="block text-right text-xs tabular-nums text-muted-foreground">
          {text.length}/{MAX_CHARS}
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={sending || text.trim().length < 15}
        className="flex items-center gap-2 self-start rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-2.5 font-medium text-white shadow-lg shadow-violet-500/30 transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
      >
        <Sparkles className="h-4 w-4" />
        {sending ? "Corrigiendo…" : grade ? "Corregir de nuevo" : "Corregir con IA"}
      </button>

      {grade && <GradeResult grade={grade} />}
    </div>
  );
}

function GradeResult({ grade }: { grade: WritingGrade }) {
  return (
    <div className="flex flex-col gap-3 duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="glass flex items-start gap-4 rounded-2xl p-4">
        <span
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center rounded-full text-lg font-bold text-white shadow-lg",
            grade.score >= 8 ? "bg-emerald-500 shadow-emerald-500/40" : grade.score >= 6 ? "bg-amber-500 shadow-amber-500/40" : "bg-red-500 shadow-red-500/40",
          )}
        >
          {grade.score}/10
        </span>
        <p className="leading-relaxed">{grade.feedback}</p>
      </div>
      {grade.corrected && (
        <div className="glass rounded-2xl p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Versión corregida
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{grade.corrected}</p>
        </div>
      )}
      {grade.corrections.length > 0 && <CorrectionCard corrections={grade.corrections} />}
    </div>
  );
}
