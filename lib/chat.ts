// Tipos y constantes compartidos entre el servidor y la pantalla del chat
import type { Correction } from "@/lib/tutor";

export type ChatRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  corrections: Correction[];
  translation: string | null;
  created_at: string;
};

/** Nombre de la agente */
export const TUTOR_NAME = "Emma";

export const MESSAGE_COLUMNS = "id, role, content, corrections, translation, created_at";

/** Máximo de caracteres por mensaje de la usuaria */
export const MAX_MESSAGE_CHARS = 500;

/** Mensajes anteriores que se envían a la IA como contexto */
export const HISTORY_LIMIT = 16;

/** Límite diario de mensajes por usuaria (configurable con DAILY_MESSAGE_LIMIT) */
export function dailyMessageLimit(): number {
  const n = Number(process.env.DAILY_MESSAGE_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

export const LIMIT_REACHED_MESSAGE =
  "Llegaste al límite de mensajes de hoy. ¡Buen trabajo! Vuelve mañana para seguir practicando 💪";

/** Día actual en UTC (así se cuenta el límite diario) */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
