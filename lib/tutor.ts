// Personalidad y reglas del agente (system prompt) + validación de su respuesta.
import type { Level } from "@/lib/levels";
import { TUTOR_NAME } from "@/lib/chat";

export const CORRECTION_TYPES = ["grammar", "vocabulary", "spelling", "word_order", "other"] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const CORRECTION_TYPE_LABEL: Record<CorrectionType, string> = {
  grammar: "Gramática",
  vocabulary: "Vocabulario",
  spelling: "Ortografía",
  word_order: "Orden de las palabras",
  other: "Otros",
};

export type Correction = {
  original: string;
  corrected: string;
  explanation: string;
  type: CorrectionType;
};

export type TutorReply = { reply: string; corrections: Correction[] };

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish (Latin American, friendly and simple)",
};

const LEVEL_GUIDE: Record<Level, string> = {
  A1: "The learner is a beginner (A1). Use only very common words and very short sentences (max ~8 words). Mostly present simple. Talk about concrete everyday things. No idioms or phrasal verbs.",
  A2: "The learner is elementary (A2). Use simple everyday vocabulary and short sentences. Present, past simple and 'going to'. Avoid idioms; if you use a less common word, make its meaning clear from context.",
  B1: "The learner is intermediate (B1). Use common vocabulary plus some useful new words. Mix tenses naturally. Common phrasal verbs are fine.",
  B2: "The learner is upper-intermediate (B2). Speak naturally with varied vocabulary, some idioms and phrasal verbs, while staying clear.",
  C1: "The learner is advanced (C1). Speak as with a fluent friend: rich vocabulary, idioms, nuance and complex structures.",
};

export type TutorContext = {
  level: Level;
  learnerName?: string | null;
  explanationLang?: string | null;
  /** Descripción de la conversación (tema guiado, juego de rol, libre...) */
  scenario?: string;
};

export function buildTutorSystemPrompt(ctx: TutorContext): string {
  const lang = LANGUAGE_NAMES[ctx.explanationLang ?? "es"] ?? LANGUAGE_NAMES.es;
  const learner = ctx.learnerName ? `The learner's name is ${ctx.learnerName}.` : "";
  const scenario =
    ctx.scenario ??
    "Free conversation: chat about whatever the learner wants. If they have no idea, suggest a fun everyday topic.";

  return `You are ${TUTOR_NAME}, a friendly native English speaker from the US, chatting by text with a friend who is learning English. ${learner}
${scenario}

STYLE
- Sound like a real friend: warm, natural, curious, never robotic and never like a teacher. Use contractions.
- Keep each reply short: 2 to 4 sentences. Always end with exactly ONE question that keeps the conversation going.
- ${LEVEL_GUIDE[ctx.level]}
- Write the reply in English only. If the learner writes in Spanish, answer in simple English and encourage them to try saying it in English.
- At most one emoji per reply.

CORRECTIONS
- Look ONLY at the learner's last message and find real mistakes: grammar, vocabulary or word choice, spelling, word order.
- Ignore capitalization, missing final punctuation, and informal style that natives also use (e.g. "gonna", "yeah").
- Do NOT mention the mistakes inside "reply"; answer the content naturally.
- For each mistake add one item: "original" = the learner's exact words that contain the mistake; "corrected" = the natural corrected version; "explanation" = short, friendly explanation in ${lang} (max 25 words); "type" = one of ${CORRECTION_TYPES.join(", ")}.
- If there are no mistakes, return an empty list. Never invent mistakes. Max 3 items.

OUTPUT
Respond ONLY with JSON in this exact shape:
{"reply": "...", "corrections": [{"original": "...", "corrected": "...", "explanation": "...", "type": "grammar"}]}`;
}

/** Esquema para que Gemini devuelva siempre el JSON correcto. */
export const TUTOR_REPLY_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    corrections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          original: { type: "STRING" },
          corrected: { type: "STRING" },
          explanation: { type: "STRING" },
          type: { type: "STRING", enum: [...CORRECTION_TYPES] },
        },
        required: ["original", "corrected", "explanation", "type"],
      },
    },
  },
  required: ["reply", "corrections"],
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseTutorReply(value: unknown): TutorReply | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const reply = str(obj.reply, 1500);
  if (!reply) return null;
  return { reply, corrections: parseCorrections(obj.corrections, 3) };
}

/** Valida la lista de correcciones que devuelve la IA */
function parseCorrections(value: unknown, max: number): Correction[] {
  return (Array.isArray(value) ? value : [])
    .map((c): Correction | null => {
      if (!c || typeof c !== "object") return null;
      const item = c as Record<string, unknown>;
      const original = str(item.original, 300);
      const corrected = str(item.corrected, 300);
      if (!original || !corrected || original === corrected) return null;
      const type = CORRECTION_TYPES.includes(item.type as CorrectionType)
        ? (item.type as CorrectionType)
        : "other";
      return { original, corrected, explanation: str(item.explanation, 300), type };
    })
    .filter((c): c is Correction => c !== null)
    .slice(0, max);
}

// --- Corrección del ejercicio de escritura de una lección ----------------------

export type WritingGrade = { score: number; feedback: string; corrected: string; corrections: Correction[] };

export function buildWritingGradePrompt(ctx: {
  level: Level;
  lessonTitle: string;
  task: string;
  explanationLang?: string | null;
}) {
  const lang = LANGUAGE_NAMES[ctx.explanationLang ?? "es"] ?? LANGUAGE_NAMES.es;
  return `You are a kind, encouraging English teacher grading a short writing exercise from a ${ctx.level} (CEFR) learner whose native language is Spanish.
Lesson: "${ctx.lessonTitle}". Task given to the learner (in Spanish): "${ctx.task}"

Grade from 1 to 10 considering task completion, correct use of the lesson's grammar or vocabulary, accuracy and range, always relative to the ${ctx.level} level: a simple but complete and correct answer at A1 deserves 9 or 10.
- "feedback": 2 or 3 short sentences in ${lang}: first what the learner did well, then the most important thing to improve. Friendly, like a tutor.
- "corrected": the learner's whole text rewritten with every mistake fixed, keeping their ideas and level (unchanged if there are no mistakes).
- "corrections": the main mistakes (max 5): "original" = the learner's exact words, "corrected", "explanation" in ${lang} (max 20 words), "type" = one of ${CORRECTION_TYPES.join(", ")}. Empty list if there are none. Never invent mistakes.
- If the text is not in English or ignores the task, give a low score and kindly explain why in the feedback.

Respond ONLY with JSON in this exact shape:
{"score": 8, "feedback": "...", "corrected": "...", "corrections": [{"original": "...", "corrected": "...", "explanation": "...", "type": "grammar"}]}`;
}

export const WRITING_GRADE_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    feedback: { type: "STRING" },
    corrected: { type: "STRING" },
    corrections: TUTOR_REPLY_SCHEMA.properties.corrections,
  },
  required: ["score", "feedback", "corrected", "corrections"],
};

export function parseWritingGrade(value: unknown): WritingGrade | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const score = Math.round(Number(obj.score));
  const feedback = str(obj.feedback, 800);
  if (!Number.isFinite(score) || !feedback) return null;
  return {
    score: Math.min(10, Math.max(1, score)),
    feedback,
    corrected: str(obj.corrected, 2000),
    corrections: parseCorrections(obj.corrections, 5),
  };
}

/** Primer mensaje del agente al abrir una conversación libre (no gasta IA). */
export function openingMessage(level: Level, learnerName?: string | null): string {
  const name = learnerName ? ` ${learnerName}` : "";
  if (level === "A1" || level === "A2") {
    return `Hi${name}! 👋 I'm ${TUTOR_NAME}. Nice to meet you! What do you want to talk about today?`;
  }
  return `Hey${name}! 👋 I'm ${TUTOR_NAME}. So good to chat with you! What's on your mind today? We can talk about anything you like.`;
}

/** Escenario de un tema guiado para el system prompt */
export function topicScenario(scenario: string) {
  return `Guided topic conversation. ${scenario}
You started this conversation. Keep it on this topic: if the learner talks about something else, react to it in one short sentence and make your question connect it back to the topic (for example, "Did you watch a game while you were traveling?").`;
}

/** Primer mensaje de un tema guiado; {name} se reemplaza por el nombre de la usuaria */
export function topicOpening(opener: string, learnerName?: string | null) {
  return opener.replaceAll("{name}", learnerName?.trim() || "there");
}

export function buildTranslatePrompt(lang = "es") {
  const name = (LANGUAGE_NAMES[lang] ?? LANGUAGE_NAMES.es).split(" (")[0];
  return `Translate the user's text from English to ${name}. Keep the tone and emojis. Reply with the translation only, nothing else.`;
}
