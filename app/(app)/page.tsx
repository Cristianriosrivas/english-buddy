import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, MessageCircle, MessagesSquare, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { LEVELS } from "@/lib/levels";
import { getProgressSummary } from "@/lib/progress";
import { InstallCard } from "@/components/pwa/pwa";
import { hasEnvVars } from "@/lib/utils";
import { setLevel } from "./actions";

const t = getDictionary();

const SECTIONS: { href: string; icon: LucideIcon; gradient: string; copy: { title: string; description: string } }[] = [
  { href: "/temas", icon: MessagesSquare, gradient: "from-violet-500 to-fuchsia-500", copy: t.sections.topics },
  { href: "/libre", icon: MessageCircle, gradient: "from-sky-500 to-cyan-400", copy: t.sections.free },
  { href: "/lecciones", icon: BookOpen, gradient: "from-amber-500 to-orange-500", copy: t.sections.lessons },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <HomeHeader />
      </Suspense>

      <section aria-label="Secciones" className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, icon: Icon, gradient, copy }) => (
          <Link
            key={href}
            href={href}
            className="glass group rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.5deg] focus-visible:-translate-y-1"
          >
            <span
              className={`mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-semibold">{copy.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
          </Link>
        ))}
      </section>

      <Suspense fallback={<div className="glass h-36 animate-pulse rounded-2xl" />}>
        <HomeProgress />
      </Suspense>

      <InstallCard />
    </div>
  );
}

/** Resumen del progreso con enlace a la página de detalle */
async function HomeProgress() {
  const supabase = await createClient();
  const { totalLessons, completedLessons, messagesSent } = await getProgressSummary(supabase);
  const pct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <Link href="/progreso" className="glass group block rounded-2xl p-5 transition-colors hover:border-primary/50">
      <span className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.home.progressTitle}</h2>
        <span className="flex items-center gap-1 text-sm text-primary">
          Ver detalle <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
      {completedLessons === 0 && messagesSent === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{t.home.progressEmpty}</p>
      ) : (
        <>
          <span className="mt-3 grid grid-cols-2 gap-3">
            <span>
              <span className="block text-2xl font-bold tabular-nums">
                {completedLessons}/{totalLessons}
              </span>
              <span className="text-xs text-muted-foreground">Lecciones completadas</span>
            </span>
            <span>
              <span className="block text-2xl font-bold tabular-nums">{messagesSent}</span>
              <span className="text-xs text-muted-foreground">Mensajes en inglés</span>
            </span>
          </span>
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400"
              style={{ width: `${pct}%` }}
            />
          </span>
        </>
      )}
    </Link>
  );
}

/** Saludo y nivel: dependen de la sesión, así que se cargan en streaming */
async function HomeHeader() {
  if (!hasEnvVars) {
    return (
      <p role="alert" className="glass rounded-xl p-3 text-sm text-amber-600 dark:text-amber-400">
        Falta configurar Supabase en <code>.env.local</code>.
      </p>
    );
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, level")
    .eq("id", userId ?? "")
    .maybeSingle();

  return (
    <>
      <section>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t.home.greeting(profile?.name)}
        </h1>
        <p className="mt-1 text-muted-foreground">{t.home.subtitle}</p>
        {(error || !profile) && (
          <p role="alert" className="glass mt-4 rounded-xl p-3 text-sm text-amber-600 dark:text-amber-400">
            {t.home.setupMissing}
          </p>
        )}
      </section>
      <LevelPanel current={profile?.level ?? null} />
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-8">
      <div className="space-y-2">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-72 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="glass h-36 animate-pulse rounded-2xl" />
    </div>
  );
}

function LevelPanel({ current }: { current: string | null }) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{current ? t.home.level : t.home.noLevel}</h2>
        {!current && <p className="text-xs text-muted-foreground">{t.home.noLevelHint}</p>}
      </div>
      <form action={setLevel} className="mt-4 grid grid-cols-5 gap-2">
        {LEVELS.map((level) => {
          const selected = level.id === current;
          return (
            <button
              key={level.id}
              type="submit"
              name="level"
              value={level.id}
              title={`${level.name}: ${level.description}`}
              aria-pressed={selected}
              className={`flex flex-col items-center rounded-xl border px-1 py-2 transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "border-border bg-background/40 hover:border-primary/60"
              }`}
            >
              <span className="text-base font-bold">{level.id}</span>
              <span className={`text-[10px] leading-tight sm:text-xs ${selected ? "" : "text-muted-foreground"}`}>
                {level.name}
              </span>
            </button>
          );
        })}
      </form>
    </section>
  );
}
