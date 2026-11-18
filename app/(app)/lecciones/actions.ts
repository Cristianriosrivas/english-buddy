"use server";

import { createClient } from "@/lib/supabase/server";
import { checkExercise, parseExercises, type ExerciseResult } from "@/lib/lessons";

export type CheckResult = { results: ExerciseResult[]; score: number } | { error: string };

/** Corrige los ejercicios en el servidor (las respuestas nunca llegan al navegador) y guarda el puntaje */
export async function checkLessonExercises(lessonId: string, answers: string[]): Promise<CheckResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { error: "Inicia sesión para continuar." };

  const { data: lesson } = await supabase.from("lessons").select("exercises").eq("id", lessonId).maybeSingle();
  const exercises = parseExercises(lesson?.exercises);
  if (!exercises.length) return { error: "No encontré esta lección." };

  const results = exercises.map((exercise, i) => checkExercise(exercise, String(answers[i] ?? "").slice(0, 200)));
  const score = Math.round((results.filter((r) => r.correct).length / results.length) * 100);

  const { error } = await supabase
    .from("lesson_progress")
    .upsert({ lesson_id: lessonId, score }, { onConflict: "user_id,lesson_id" });
  if (error) {
    console.error("[lessons] save score failed:", error.message);
    return { error: "No pude guardar tu resultado. Inténtalo de nuevo." };
  }

  return { results, score };
}
