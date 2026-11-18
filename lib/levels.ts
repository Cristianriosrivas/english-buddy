// Niveles del Marco Común Europeo (MCER / CEFR) que usa la app
export const LEVELS = [
  { id: "A1", name: "Principiante", description: "Frases muy básicas, presentarte, números y saludos." },
  { id: "A2", name: "Básico", description: "Situaciones sencillas: compras, rutina, familia." },
  { id: "B1", name: "Intermedio", description: "Viajes, experiencias, opiniones simples." },
  { id: "B2", name: "Intermedio alto", description: "Conversaciones fluidas sobre temas variados." },
  { id: "C1", name: "Avanzado", description: "Matices, temas abstractos y lenguaje profesional." },
] as const;

export type Level = (typeof LEVELS)[number]["id"];

export function isLevel(value: unknown): value is Level {
  return LEVELS.some((l) => l.id === value);
}

/** Velocidad de lectura en voz alta según el nivel: más pausada para principiantes */
export function speechRateFor(level: string) {
  return ({ A1: 0.85, A2: 0.9, B1: 0.95 } as Record<string, number>)[level] ?? 1;
}

/** ¿El nivel de la usuaria alcanza el mínimo pedido? (A1 < A2 < B1 < B2 < C1) */
export function meetsLevel(level: Level, minLevel: Level) {
  const index = (id: Level) => LEVELS.findIndex((l) => l.id === id);
  return index(level) >= index(minLevel);
}
