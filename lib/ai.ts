// Capa de IA aislada. Solo se usa en el servidor (rutas app/api).
// Proveedores: Gemini y Groq (ambos con capa gratuita). Se prueban en el orden de
// AI_PROVIDER (por defecto "gemini,groq") usando solo los que tienen clave; si uno
// responde "límite alcanzado" o falla el servidor, se pasa al siguiente.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type GenerateOptions = {
  system: string;
  messages: ChatMessage[];
  /** Pide respuesta en JSON. Con Gemini, `schema` además la valida. */
  json?: boolean;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
};

export class AIError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AIError";
  }
}

type Provider = {
  apiKey: () => string | undefined;
  run: (opts: GenerateOptions, apiKey: string, timeoutMs: number) => Promise<string>;
};

const TIMEOUT_MS = 30_000;
// Si hay otro proveedor de respaldo, no esperar tanto al primero
const FALLBACK_TIMEOUT_MS = 12_000;

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw new AIError(`Network error: ${String(error)}`, 504, true);
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new AIError(`HTTP ${res.status}: ${detail}`, res.status, res.status === 429 || res.status >= 500);
  }
  return res.json();
}

// --- Gemini (Google AI Studio) -------------------------------------------------
const gemini: Provider = {
  apiKey: () => process.env.GEMINI_API_KEY,
  async run(opts, apiKey, timeoutMs) {
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
    // Gemini exige que la conversación empiece con la usuaria y alterne turnos
    const turns: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const m of opts.messages) {
      const role = m.role === "assistant" ? "model" : "user";
      const last = turns.at(-1);
      if (last?.role === role) last.parts.push({ text: m.content });
      else turns.push({ role, parts: [{ text: m.content }] });
    }
    if (turns[0]?.role === "model") turns.unshift({ role: "user", parts: [{ text: "(start)" }] });

    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: turns,
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          // Los modelos con "thinking" gastan parte de este presupuesto pensando
          maxOutputTokens: opts.maxTokens ?? 4096,
          ...(opts.json && { responseMimeType: "application/json" }),
          ...(opts.json && opts.schema && { responseSchema: opts.schema }),
        },
      },
      timeoutMs,
    );
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text) throw new AIError(`Empty Gemini response (${data?.candidates?.[0]?.finishReason ?? "?"})`, 502, true);
    return text;
  },
};

// --- Groq (API compatible con OpenAI) -----------------------------------------
const groq: Provider = {
  apiKey: () => process.env.GROQ_API_KEY,
  async run(opts, apiKey, timeoutMs) {
    const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    // gpt-oss razona antes de responder: poco razonamiento = respuestas rápidas
    const reasoning = model.startsWith("openai/gpt-oss");
    const data = await post(
      "https://api.groq.com/openai/v1/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? (reasoning ? 2048 : 1024),
        ...(reasoning && { reasoning_effort: "low" }),
        ...(opts.json && { response_format: { type: "json_object" } }),
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
      },
      timeoutMs,
    );
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text) throw new AIError("Empty Groq response", 502, true);
    return text;
  },
};

const PROVIDERS: Record<string, Provider> = { gemini, groq };

function activeProviders() {
  const order = (process.env.AI_PROVIDER || "gemini,groq")
    .split(",")
    .map((p) => p.trim().toLowerCase());
  return order
    .map((name) => ({ name, provider: PROVIDERS[name] }))
    .filter((p) => p.provider?.apiKey());
}

/** Genera texto con el primer proveedor disponible (y respaldo automático). */
export async function generate(opts: GenerateOptions): Promise<string> {
  const providers = activeProviders();
  if (providers.length === 0) {
    throw new AIError("No AI provider configured (GEMINI_API_KEY / GROQ_API_KEY)", 500, false);
  }
  let lastError: unknown;
  for (const [i, { name, provider }] of providers.entries()) {
    const isLast = i === providers.length - 1;
    try {
      return await provider.run(opts, provider.apiKey()!, isLast ? TIMEOUT_MS : FALLBACK_TIMEOUT_MS);
    } catch (error) {
      // Cualquier fallo (límite, saturación, clave o modelo inválido): probar el siguiente
      lastError = error;
      console.error(`[ai] ${name} failed:`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError;
}

/** Genera JSON y lo valida; si la respuesta no sirve, reintenta una vez. */
export async function generateJSON<T>(
  opts: GenerateOptions,
  validate: (value: unknown) => T | null,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generate({ ...opts, json: true });
    try {
      const parsed = validate(JSON.parse(stripCodeFence(raw)));
      if (parsed) return parsed;
    } catch {
      // JSON inválido: reintentar
    }
    console.warn("[ai] respuesta JSON no válida:", raw.slice(0, 300));
  }
  throw new AIError("Invalid JSON from AI", 502, true);
}

function stripCodeFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
}

/** Mensaje en español para mostrar cuando la IA falla. */
export function aiErrorMessage(error: unknown): string {
  if (error instanceof AIError) {
    if (error.status === 429) return "La IA está muy ocupada en este momento. Espera un minuto y vuelve a intentarlo.";
    if (error.status === 500 && !error.retryable) return "Falta configurar la clave de la IA en el servidor.";
  }
  return "No pude contactar a la IA. Inténtalo de nuevo en unos segundos.";
}
