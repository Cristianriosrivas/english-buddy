import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, parseExamples, parseExercises, toPublicExercise, type LessonKind } from "@/lib/lessons";
import { ExampleList } from "@/components/lessons/example-list";
import { LessonExercises } from "@/components/lessons/lesson-exercises";
import { WritingExercise } from "@/components/lessons/writing-exercise";

export const metadata = { title: "Lección" };

type Params = Promise<{ id: string }>;

export default function LessonPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <LessonLoader params={params} />
    </Suspense>
  );
}

async function LessonLoader({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: lesson }, { data: progress }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, level, kind, title, explanation, examples, exercises, writing_prompt")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("lesson_progress").select("score, writing_score, completed").eq("lesson_id", id).maybeSingle(),
  ]);
  if (!lesson) notFound();

  // Las respuestas se quedan en el servidor: al navegador solo van las preguntas
  const exercises = parseExercises(lesson.exercises).map(toPublicExercise);

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={`/lecciones?nivel=${lesson.level}`}
          className="flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Lecciones {lesson.level}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{lesson.level}</span>
          <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-sky-700 dark:text-sky-300">
            {KIND_LABEL[lesson.kind as LessonKind] ?? lesson.kind}
          </span>
          {progress?.completed && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completada
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{lesson.title}</h1>
      </header>

      <Section number={1} title="Explicación">
        <p className="glass rounded-2xl p-5 leading-relaxed">{lesson.explanation}</p>
      </Section>

      <Section number={2} title="Ejemplos">
        <ExampleList examples={parseExamples(lesson.examples)} level={lesson.level} />
      </Section>

      <Section number={3} title="Ejercicios" hint="Completa los espacios o elige la opción correcta.">
        <LessonExercises lessonId={lesson.id} exercises={exercises} lastScore={progress?.score ?? null} />
      </Section>

      <Section number={4} title="Escritura" hint="La IA califica tu texto de 1 a 10 y te explica cómo mejorarlo.">
        <WritingExercise lessonId={lesson.id} prompt={lesson.writing_prompt} lastScore={progress?.writing_score ?? null} />
      </Section>
    </article>
  );
}

function Section({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-sm text-white">
            {number}
          </span>
          {title}
        </h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function LessonSkeleton() {
  return (
    <div aria-busy className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="h-6 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-3/4 animate-pulse rounded-xl bg-muted" />
      <div className="glass h-32 animate-pulse rounded-2xl" />
      <div className="glass h-48 animate-pulse rounded-2xl" />
    </div>
  );
}
