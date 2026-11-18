import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, MessageCircle, PencilLine, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { LEVELS } from "@/lib/levels";
import { getProgressSummary } from "@/lib/progress";
import { CORRECTION_TYPE_LABEL, CORRECTION_TYPES, type Correction } from "@/lib/tutor";

export const metadata = { title: "Progreso" };

const t = getDictionary().sections.progress;

export default function ProgresoPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.description}</p>
      </header>
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </div>
  );
}

type LessonRow = { id: string; level: string; title: string };
type ProgressRow = {
  lesson_id: string;
  score: number | null;
  writing_score: number | null;
  completed: boolean;
  updated_at: string;
};

async function ProgressContent() {
  const supabase = await createClient();
  const [summary, { data: lessons }, { data: progress }, { data: corrected }] = await Promise.all([
    getProgressSummary(supabase),
    supabase.from("lessons").select("id, level, title"),
    supabase.from("lesson_progress").select("lesson_id, score, writing_score, completed, updated_at"),
    // Mensajes con correcciones (las más recientes) para ver los errores frecuentes
    supabase
      .from("messages")
      .select("corrections, created_at")
      .eq("role", "user")
      .neq("corrections", "[]")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const lessonById = new Map(((lessons ?? []) as LessonRow[]).map((l) => [l.id, l]));
  const rows = (progress ?? []) as ProgressRow[];
  const completed = rows
    .filter((p) => p.completed && lessonById.has(p.lesson_id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const writingScores = rows.map((p) => p.writing_score).filter((s): s is number => s !== null);
  const avgWriting = writingScores.length
    ? (writingScores.reduce((a, b) => a + b, 0) / writingScores.length).toFixed(1)
    : null;

  const corrections = (corrected ?? []).flatMap((m) => (Array.isArray(m.corrections) ? (m.corrections as Correction[]) : []));
  const byType = CORRECTION_TYPES.map((type) => ({
    type,
    count: corrections.filter((c) => c.type === type).length,
  }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...byType.map((t) => t.count));

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={BookOpen} label="Lecciones completadas" value={`${summary.completedLessons}/${summary.totalLessons}`} />
        <Stat icon={MessageCircle} label="Mensajes en inglés" value={summary.messagesSent} />
        <Stat icon={PencilLine} label="Correcciones recibidas" value={corrections.length} />
        <Stat icon={Star} label="Nota media de escritura" value={avgWriting ? `${avgWriting}/10` : "—"} />
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 text-lg font-semibold">Lecciones por nivel</h2>
        <ul className="grid gap-3">
          {LEVELS.map(({ id, name }) => {
            const ofLevel = [...lessonById.values()].filter((l) => l.level === id);
            const done = completed.filter((p) => lessonById.get(p.lesson_id)?.level === id).length;
            const pct = ofLevel.length ? Math.round((done / ofLevel.length) * 100) : 0;
            return (
              <li key={id}>
                <Link href={`/lecciones?nivel=${id}`} className="group block">
                  <span className="mb-1 flex justify-between text-sm">
                    <span className="group-hover:text-primary">
                      <strong>{id}</strong> <span className="text-muted-foreground">· {name}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {done}/{ofLevel.length}
                    </span>
                  </span>
                  <Bar value={pct} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-1 text-lg font-semibold">Errores frecuentes</h2>
          <p className="mb-4 text-sm text-muted-foreground">Según las correcciones de tus conversaciones.</p>
          {byType.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay correcciones. ¡Conversa con Emma para empezar!</p>
          ) : (
            <>
              <ul className="mb-5 grid gap-3">
                {byType.map(({ type, count }) => (
                  <li key={type}>
                    <span className="mb-1 flex justify-between text-sm">
                      <span>{CORRECTION_TYPE_LABEL[type]}</span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </span>
                    <Bar value={(count / maxCount) * 100} tone="amber" />
                  </li>
                ))}
              </ul>
              <h3 className="mb-2 text-sm font-semibold">Últimas correcciones</h3>
              <ul className="grid gap-2 text-sm">
                {corrections.slice(0, 6).map((c, i) => (
                  <li key={i} className="rounded-xl bg-background/60 p-2.5 dark:bg-white/5">
                    <span className="text-red-600 line-through decoration-red-400/70 dark:text-red-400">{c.original}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{c.corrected}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 text-lg font-semibold">Lecciones completadas</h2>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Completa los ejercicios y la escritura de una{" "}
              <Link href="/lecciones" className="font-medium text-primary underline underline-offset-4">
                lección
              </Link>{" "}
              para verla aquí.
            </p>
          ) : (
            <ul className="grid gap-2">
              {completed.slice(0, 10).map((p) => {
                const lesson = lessonById.get(p.lesson_id)!;
                return (
                  <li key={p.lesson_id}>
                    <Link
                      href={`/lecciones/${lesson.id}`}
                      className="flex items-center gap-3 rounded-xl bg-background/60 p-2.5 text-sm transition-colors hover:bg-primary/10 dark:bg-white/5"
                    >
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {lesson.level}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {p.score}% · {p.writing_score}/10
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Bar({ value, tone = "primary" }: { value: number; tone?: "primary" | "amber" }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-muted">
      <span
        className={`block h-full rounded-full transition-[width] duration-700 ${
          tone === "amber" ? "bg-amber-500" : "bg-gradient-to-r from-violet-500 to-sky-400"
        }`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </span>
  );
}

function ProgressSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="glass h-56 animate-pulse rounded-2xl" />
    </div>
  );
}
