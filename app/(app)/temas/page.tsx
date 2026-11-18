import { Suspense } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { isLevel, meetsLevel } from "@/lib/levels";
import { SubmitButton } from "@/components/submit-button";
import { ChooseLevelNotice } from "@/components/choose-level-notice";
import { RecentConversations } from "@/components/chat/recent-conversations";
import { startTopicConversation } from "./actions";

export const metadata = { title: "Temas guiados" };

const t = getDictionary().sections.topics;

export default function TemasPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.description}</p>
      </header>

      <Suspense fallback={<TopicGridSkeleton />}>
        <TopicGrid />
      </Suspense>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tus conversaciones por tema</h2>
        <Suspense fallback={<div className="glass h-24 animate-pulse rounded-2xl" />}>
          <RecentConversations mode="topic" />
        </Suspense>
      </section>
    </div>
  );
}

type Topic = { id: string; name: string; description: string; min_level: string; emoji: string };

async function TopicGrid() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const [{ data: profile }, { data: topics }] = await Promise.all([
    supabase.from("profiles").select("level").eq("id", auth?.claims?.sub ?? "").maybeSingle(),
    supabase.from("topics").select("id, name, description, min_level, emoji").order("sort_order"),
  ]);

  const level = profile?.level;
  if (!isLevel(level)) return <ChooseLevelNotice />;
  if (!topics?.length) {
    return <p className="glass rounded-2xl p-5 text-sm text-muted-foreground">Todavía no hay temas disponibles.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(topics as Topic[]).map((topic) => {
        const unlocked = isLevel(topic.min_level) && meetsLevel(level, topic.min_level);
        return <li key={topic.id}>{unlocked ? <TopicCard topic={topic} /> : <LockedTopicCard topic={topic} />}</li>;
      })}
    </ul>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <form action={startTopicConversation} className="h-full">
      <input type="hidden" name="topicId" value={topic.id} />
      <SubmitButton className="glass group flex h-full w-full flex-col gap-2 rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
        <TopicCardBody topic={topic} />
        <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-primary">
          <span className="group-aria-busy:hidden">Conversar</span>
          <span className="hidden group-aria-busy:inline">Abriendo chat…</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-aria-busy:hidden" />
        </span>
      </SubmitButton>
    </form>
  );
}

function LockedTopicCard({ topic }: { topic: Topic }) {
  return (
    <div aria-disabled className="glass flex h-full flex-col gap-2 rounded-2xl p-5 opacity-60">
      <TopicCardBody topic={topic} />
      <span className="mt-auto flex items-center gap-1 pt-1 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Disponible desde el nivel {topic.min_level}
      </span>
    </div>
  );
}

function TopicCardBody({ topic }: { topic: Topic }) {
  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span aria-hidden className="text-3xl leading-none">
          {topic.emoji}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {topic.min_level}+
        </span>
      </span>
      <span className="text-lg font-semibold leading-tight">{topic.name}</span>
      <span className="text-sm text-muted-foreground">{topic.description}</span>
    </>
  );
}

function TopicGridSkeleton() {
  return (
    <div aria-busy className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}
