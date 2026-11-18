// Tipos y corrección automática de los ejercicios de las lecciones.

export type LessonKind = "grammar" | "vocabulary";

export const KIND_LABEL: Record<LessonKind, string> = {
  grammar: "Gramática",
  vocabulary: "Vocabulario",
};

export type LessonExample = { en: string; es: string };

/** Completar el espacio "___" (se aceptan varias respuestas) */
export type FillExercise = { type: "fill"; prompt: string; answers: string[] };
/** Elegir la opción correcta (answer = índice) */
export type ChoiceExercise = { type: "choice"; prompt: string; options: string[]; answer: number };
export type Exercise = FillExercise | ChoiceExercise;

/** Lo que ve el navegador: sin las respuestas, que solo se revisan en el servidor */
export type PublicExercise = { type: "fill"; prompt: string } | { type: "choice"; prompt: string; options: string[] };

export type ExerciseResult = { correct: boolean; expected: string };

export function toPublicExercise(exercise: Exercise): PublicExercise {
  return exercise.type === "choice"
    ? { type: "choice", prompt: exercise.prompt, options: exercise.options }
    : { type: "fill", prompt: exercise.prompt };
}

/** Normaliza para comparar: minúsculas, apóstrofos rectos, sin puntuación final ni espacios extra */
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkExercise(exercise: Exercise, answer: string): ExerciseResult {
  if (exercise.type === "choice") {
    return { correct: Number(answer) === exercise.answer, expected: exercise.options[exercise.answer] ?? "" };
  }
  const given = normalize(answer);
  return {
    correct: given !== "" && exercise.answers.some((a) => normalize(a) === given),
    expected: exercise.answers[0] ?? "",
  };
}

/** Valida el JSON de ejercicios que viene de la base de datos */
export function parseExercises(value: unknown): Exercise[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is Exercise => {
    if (!e || typeof e !== "object" || typeof e.prompt !== "string") return false;
    if (e.type === "fill") return Array.isArray(e.answers) && e.answers.length > 0;
    if (e.type === "choice") return Array.isArray(e.options) && Number.isInteger(e.answer);
    return false;
  });
}

export function parseExamples(value: unknown): LessonExample[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is LessonExample => typeof e?.en === "string" && typeof e?.es === "string");
}
