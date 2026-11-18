import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Totales rápidos (solo cuentan filas, sin traer datos) */
export async function getProgressSummary(supabase: Supabase) {
  const [lessons, completed, messages] = await Promise.all([
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("completed", true),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("role", "user"),
  ]);
  return {
    totalLessons: lessons.count ?? 0,
    completedLessons: completed.count ?? 0,
    messagesSent: messages.count ?? 0,
  };
}
