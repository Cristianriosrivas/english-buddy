import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiErrorMessage, generateJSON } from "@/lib/ai";
import { buildWritingGradePrompt, parseWritingGrade, WRITING_GRADE_SCHEMA } from "@/lib/tutor";
import { dailyMessageLimit, LIMIT_REACHED_MESSAGE, todayUTC } from "@/lib/chat";
import { isLevel } from "@/lib/levels";

const MIN_CHARS = 15;
const MAX_CHARS = 1200;

const fail = (error: string, status: number, extra?: object) =>
  NextResponse.json({ error, ...extra }, { status });

/** La IA califica (1-10) el ejercicio de escritura de una lección y se guarda la nota. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return fail("Inicia sesión para continuar.", 401);

  const body = await request.json().catch(() => null);
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!lessonId) return fail("Falta la lección.", 400);
  if (text.length < MIN_CHARS) return fail("Escribe un poco más para que pueda corregirlo.", 400);
  if (text.length > MAX_CHARS) return fail(`Tu texto es muy largo (máximo ${MAX_CHARS} caracteres).`, 400);

  const limit = dailyMessageLimit();
  const [lessonRes, profileRes, usageRes] = await Promise.all([
    supabase.from("lessons").select("id, level, title, writing_prompt").eq("id", lessonId).maybeSingle(),
    supabase.from("profiles").select("explanation_lang").eq("id", userId).maybeSingle(),
    supabase.from("usage_daily").select("messages").eq("user_id", userId).eq("day", todayUTC()).maybeSingle(),
  ]);

  const lesson = lessonRes.data;
  if (!lesson || !isLevel(lesson.level)) return fail("No encontré esta lección.", 404);
  if ((usageRes.data?.messages ?? 0) >= limit) {
    return fail(LIMIT_REACHED_MESSAGE, 429, { remaining: 0, limitReached: true });
  }

  let grade;
  try {
    grade = await generateJSON(
      {
        system: buildWritingGradePrompt({
          level: lesson.level,
          lessonTitle: lesson.title,
          task: lesson.writing_prompt,
          explanationLang: profileRes.data?.explanation_lang,
        }),
        messages: [{ role: "user", content: text }],
        schema: WRITING_GRADE_SCHEMA,
        temperature: 0.3,
      },
      parseWritingGrade,
    );
  } catch (error) {
    console.error("[lesson-writing] grading failed:", error);
    return fail(aiErrorMessage(error), 503);
  }

  // La corrección cuenta para el límite diario, igual que un mensaje del chat
  const [{ error: saveError }, { data: remaining }] = await Promise.all([
    supabase
      .from("lesson_progress")
      .upsert({ lesson_id: lessonId, writing_score: grade.score }, { onConflict: "user_id,lesson_id" }),
    supabase.rpc("consume_message_quota", { p_limit: limit }),
  ]);
  if (saveError) console.error("[lesson-writing] save failed:", saveError.message);

  return NextResponse.json({
    grade,
    remaining: typeof remaining === "number" && remaining >= 0 ? remaining : 0,
  });
}
