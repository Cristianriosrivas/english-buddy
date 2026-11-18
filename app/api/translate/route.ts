import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage, generate } from "@/lib/ai";
import { buildTranslatePrompt } from "@/lib/tutor";

/** Traduce una respuesta del agente y guarda la traducción para no repetir la llamada. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";

  const [{ data: message }, { data: profile }] = await Promise.all([
    supabase.from("messages").select("id, role, content, translation").eq("id", messageId).maybeSingle(),
    supabase.from("profiles").select("explanation_lang").eq("id", userId).maybeSingle(),
  ]);
  if (!message || message.role !== "assistant") {
    return NextResponse.json({ error: "No encontré ese mensaje." }, { status: 404 });
  }
  if (message.translation) return NextResponse.json({ translation: message.translation });

  try {
    const translation = (
      await generate({
        system: buildTranslatePrompt(profile?.explanation_lang ?? "es"),
        messages: [{ role: "user", content: message.content }],
        temperature: 0.2,
      })
    ).trim();
    await supabase.from("messages").update({ translation }).eq("id", messageId);
    return NextResponse.json({ translation });
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 503 });
  }
}
