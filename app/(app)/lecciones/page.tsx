import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { isLevel, LEVELS, type Level } from "@/lib/levels";
import { KIND_LABEL, type LessonKind } from "@/lib/lessons";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lecciones" };

const t = getDictionary().sections.lessons;

type SearchParams = Promise<{ nivel?: string }>;

export default function LeccionesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.description}</p>
      </header>
      <Suspense fallback={<LessonsSkeleton />}>
        <LessonList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type LessonRow = { id: string; level: Level; kind: LessonKind; title: string };
type ProgressRow = { lesson_id: string; score: number | null; writing_score: number | null; completed: boolean };

async function LessonList({ searchParams }: { searchParams: SearchParams }) {
  const { nivel } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data: profile }, { data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("level").eq("id", auth?.claims?.sub ?? "").maybeSingle(),
    supabase.from("lessons").select("id, level, kind, title").order("level").order("sort_order"),
    supabase.from("lesson_progress").select("lesson_id, score, writing_score, completed"),
  ]);

  const userLevel: Level = isLevel(profile?.level) ? profile.level : "A1";
  const selected: Level = isLevel(nivel) ? nivel : userLevel;
  const all = (lessons ?? []) as LessonRow[];
  const progressById = new Map(((progress ?? []) as ProgressRow[]).map((p) => [p.lesson_id, p]));
  const visible = all.filter((l) => l.level === selected);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Niveles" className="flex gap-2 overflow-x-auto pb-1">
        {LEVELS.map(({ id }) => {
          const ofLevel = all.filter((l) => l.level === id);
          const done = ofLevel.filter((l) => progressById.get(l.id)?.completed).length;
          return (
            <Link
              key={id}
              href={`/lecciones?nivel=${id}`}
              aria-current={id === selected ? "page" : undefined}
              className={cn(
                "glass flex shrink-0 flex-col items-center rounded-2xl px-4 py-2 text-sm transition-colors",
                id === selected ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:border-primary/40",
              )}
            >
              <span>
                {id}
                {id === userLevel && <span className="ml-1 text-[10px] font-normal">· tu nivel</span>}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {done}/{ofLevel.length}
              </span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <p className="glass rounded-2xl p-5 text-sm text-muted-foreground">Todavía no hay lecciones en este nivel.</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {visible.map((lesson, i) => (
            <li key={lesson.id}>
              <LessonCard lesson={lesson} number={i + 1} progress={progressById.get(lesson.id)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LessonCard({ lesson, number, progress }: { lesson: LessonRow; number: number; progress?: ProgressRow }) {
  const status = progress?.completed
    ? `Completada · ${progress.score}% · escritura ${progress.writing_score}/10`
    : progress
      ? "En progreso"
      : "Empezar";
  return (
    <Link
      href={`/lecciones/${lesson.id}`}
      className="glass group flex h-full items-center gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50"
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full font-semibold",
          progress?.completed ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary",
        )}
      >
        {progress?.completed ? <CheckCircle2 className="h-5 w-5" /> : number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {KIND_LABEL[lesson.kind]}
        </span>
        <span className="block font-semibold leading-tight">{lesson.title}</span>
        <span
          className={cn(
            "mt-0.5 block text-xs",
            progress?.completed ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {status}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function LessonsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="flex gap-2">
        {LEVELS.map(({ id }) => (
          <div key={id} className="glass h-14 w-16 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass h-20 animate-pulse rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
