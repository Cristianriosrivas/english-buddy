import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage, generateJSON, type ChatMessage } from "@/lib/ai";
import { buildTutorSystemPrompt, parseTutorReply, topicScenario, TUTOR_REPLY_SCHEMA } from "@/lib/tutor";
import {
  dailyMessageLimit,
  HISTORY_LIMIT,
  LIMIT_REACHED_MESSAGE,
  MAX_MESSAGE_CHARS,
  MESSAGE_COLUMNS,
  todayUTC,
} from "@/lib/chat";
import { isLevel } from "@/lib/levels";

const fail = (error: string, status: number, extra?: object) =>
  NextResponse.json({ error, ...extra }, { status });

/** Si la conversación es de un tema guiado, devuelve su escenario para la agente */
function topicScenarioOf(conversation: { topics?: TopicRef | TopicRef[] | null }) {
  // Supabase devuelve un objeto (cada conversación tiene un solo tema); sin tipos generados, TS lo ve como lista
  const topic = Array.isArray(conversation.topics) ? conversation.topics[0] : conversation.topics;
  return topic?.scenario ? topicScenario(topic.scenario) : undefined;
}
type TopicRef = { scenario?: string };

/** Recibe un mensaje de la usuaria, pide la respuesta a la IA y guarda ambos. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return fail("Inicia sesión para continuar.", 401);

  const body = await request.json().catch(() => null);
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  const voice = body?.voice === true; // llamada en vivo: respuestas cortas para leer en voz alta
  if (!conversationId || !text) return fail("Escribe un mensaje.", 400);
  if (text.length > MAX_MESSAGE_CHARS) {
    return fail(`Tu mensaje es muy largo (máximo ${MAX_MESSAGE_CHARS} caracteres).`, 400);
  }

  const limit = dailyMessageLimit();
  const [conversationRes, profileRes, usageRes, historyRes] = await Promise.all([
    supabase.from("conversations").select("id, level, title, topics(scenario)").eq("id", conversationId).maybeSingle(),
    supabase.from("profiles").select("name, explanation_lang").eq("id", userId).maybeSingle(),
    supabase.from("usage_daily").select("messages").eq("user_id", userId).eq("day", todayUTC()).maybeSingle(),
    supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  const conversation = conversationRes.data;
  if (!conversation || !isLevel(conversation.level)) return fail("No encontré esta conversación.", 404);

  const used = usageRes.data?.messages ?? 0;
  if (used >= limit) return fail(LIMIT_REACHED_MESSAGE, 429, { remaining: 0, limitReached: true });

  const history = ((historyRes.data ?? []) as ChatMessage[]).reverse();

  let result;
  try {
    result = await generateJSON(
      {
        system: buildTutorSystemPrompt({
          level: conversation.level,
          learnerName: profileRes.data?.name,
          explanationLang: profileRes.data?.explanation_lang,
          scenario: topicScenarioOf(conversation),
          voice,
        }),
        messages: [...history, { role: "user", content: text }],
        schema: TUTOR_REPLY_SCHEMA,
        temperature: 0.8,
      },
      parseTutorReply,
    );
  } catch (error) {
    return fail(aiErrorMessage(error), 503);
  }

  // Solo se guarda (y se cuenta) cuando la IA respondió bien
  const { data: rows, error } = await supabase
    .from("messages")
    .insert([
      { conversation_id: conversationId, role: "user", content: text, corrections: result.corrections },
      // En inserciones múltiples, las columnas que faltan se envían como null
      { conversation_id: conversationId, role: "assistant", content: result.reply, corrections: [] },
    ])
    .select(MESSAGE_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[chat] insert failed:", error.message);
    return fail("No pude guardar el mensaje. Inténtalo de nuevo.", 500);
  }

  const [{ data: remaining }] = await Promise.all([
    supabase.rpc("consume_message_quota", { p_limit: limit }),
    supabase
      .from("conversations")
      .update({ title: conversation.title ?? text.slice(0, 60) })
      .eq("id", conversationId),
  ]);

  return NextResponse.json({
    messages: rows,
    remaining: typeof remaining === "number" && remaining >= 0 ? remaining : 0,
  });
}
