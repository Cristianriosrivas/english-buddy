"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { checkLessonExercises } from "@/app/(app)/lecciones/actions";
import type { ExerciseResult, PublicExercise } from "@/lib/lessons";
import { cn } from "@/lib/utils";

const BLANK = "___";

/** Ejercicios de completar y de opción múltiple, corregidos en el servidor */
export function LessonExercises({
  lessonId,
  exercises,
  lastScore,
}: {
  lessonId: string;
  exercises: PublicExercise[];
  lastScore: number | null;
}) {
  const [answers, setAnswers] = useState<string[]>(() => exercises.map(() => ""));
  const [results, setResults] = useState<ExerciseResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allAnswered = answers.every((a) => a.trim() !== "");

  function check() {
    setError(null);
    startTransition(async () => {
      const response = await checkLessonExercises(lessonId, answers);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      setResults(response.results);
      setScore(response.score);
    });
  }

  function retry() {
    setAnswers(exercises.map(() => ""));
    setResults(null);
    setScore(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {lastScore !== null && results === null && (
        <p className="text-sm text-muted-foreground">Tu último resultado: {lastScore}%</p>
      )}

      <ol className="grid gap-3">
        {exercises.map((exercise, i) => (
          <ExerciseItem
            key={i}
            number={i + 1}
            exercise={exercise}
            value={answers[i]}
            result={results?.[i]}
            disabled={results !== null || pending}
            onChange={(value) => setAnswers((prev) => prev.map((a, j) => (j === i ? value : a)))}
          />
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {results && score !== null ? (
        <ScoreBanner score={score} onRetry={retry} />
      ) : (
        <button
          type="button"
          onClick={check}
          disabled={!allAnswered || pending}
          className="self-start rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none"
        >
          {pending ? "Revisando…" : "Comprobar respuestas"}
        </button>
      )}
    </div>
  );
}

function ExerciseItem({
  number,
  exercise,
  value,
  result,
  disabled,
  onChange,
}: {
  number: number;
  exercise: PublicExercise;
  value: string;
  result?: ExerciseResult;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [before, after] = exercise.prompt.includes(BLANK)
    ? [exercise.prompt.slice(0, exercise.prompt.indexOf(BLANK)), exercise.prompt.slice(exercise.prompt.indexOf(BLANK) + BLANK.length)]
    : [exercise.prompt, ""];

  return (
    <li
      className={cn(
        "glass rounded-2xl p-4 transition-colors",
        result?.correct && "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-500/10",
        result && !result.correct && "border-red-500/50 bg-red-50/60 dark:bg-red-500/10",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          {exercise.type === "fill" ? (
            <p className="leading-loose">
              {before}
              <input
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                aria-label={`Respuesta ${number}`}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={60}
                className="mx-1 inline-block w-28 min-w-20 rounded-lg border bg-background/80 px-2 py-0.5 text-center outline-none [field-sizing:content] focus:ring-2 focus:ring-ring disabled:opacity-90"
              />
              {after}
            </p>
          ) : (
            <>
              <p>{exercise.prompt.replace(BLANK, "____")}</p>
              <div role="radiogroup" aria-label={`Opciones ${number}`} className="mt-2 flex flex-wrap gap-2">
                {exercise.options.map((option, i) => {
                  const selected = value === String(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => onChange(String(i))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "bg-background/70 hover:border-primary/50",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {result && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1.5 text-sm font-medium duration-300 animate-in fade-in",
                result.correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {result.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {result.correct ? "¡Correcto!" : `Respuesta correcta: ${result.expected}`}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function ScoreBanner({ score, onRetry }: { score: number; onRetry: () => void }) {
  const message =
    score === 100
      ? "¡Perfecto! 🎉"
      : score >= 80
        ? "¡Muy bien! 💪"
        : score >= 60
          ? "Bien, sigue practicando."
          : "Repasa la explicación y vuelve a intentarlo.";
  return (
    <div className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4 duration-500 animate-in fade-in zoom-in-95">
      <span
        className={cn(
          "grid h-16 w-16 place-items-center rounded-full text-xl font-bold text-white shadow-lg",
          score >= 80 ? "bg-emerald-500 shadow-emerald-500/40" : score >= 60 ? "bg-amber-500 shadow-amber-500/40" : "bg-red-500 shadow-red-500/40",
          score === 100 && "animate-bounce",
        )}
      >
        {score}%
      </span>
      <div className="flex-1">
        <p className="font-semibold">{message}</p>
        <p className="text-sm text-muted-foreground">Tu resultado quedó guardado en tu progreso.</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors hover:border-primary/50 hover:text-primary"
      >
        <RotateCcw className="h-4 w-4" /> Intentar de nuevo
      </button>
    </div>
  );
}
