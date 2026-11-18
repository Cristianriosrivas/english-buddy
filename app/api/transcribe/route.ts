import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage, transcribeAudio } from "@/lib/ai";

// ~1 minuto de audio comprimido pesa mucho menos; Vercel acepta hasta 4,5 MB por petición
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Recibe el audio grabado en el celular y devuelve el texto en inglés (Whisper). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return fail("Inicia sesión para continuar.", 401);

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return fail("No recibí el audio. Inténtalo de nuevo.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return fail("El audio es muy largo. Graba como máximo 1 minuto.", 413);

  // iPhone graba en mp4 (AAC); Chrome y Android en webm (Opus)
  const type = audio.type || "audio/webm";
  const extension = type.includes("mp4") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";

  try {
    const text = await transcribeAudio(audio, `audio.${extension}`);
    if (!text) return fail("No te escuché. Habla un poco más cerca del micrófono.", 422);
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[transcribe] failed:", error);
    return fail(aiErrorMessage(error), 503);
  }
}
