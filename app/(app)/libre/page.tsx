import { Suspense } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { SubmitButton } from "@/components/submit-button";
import { ChooseLevelNotice } from "@/components/choose-level-notice";
import { RecentConversations } from "@/components/chat/recent-conversations";
import { startFreeConversation } from "./actions";

export const metadata = { title: "Conversación libre" };

const t = getDictionary().sections.free;

export default function LibrePage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.description}</p>
      </header>

      <Suspense fallback={<div className="glass h-14 w-56 animate-pulse rounded-2xl" />}>
        <StartConversation />
      </Suspense>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Tus conversaciones</h2>
        <Suspense fallback={<div className="glass h-24 animate-pulse rounded-2xl" />}>
          <RecentConversations mode="free" />
        </Suspense>
      </section>
    </div>
  );
}

/** Botón para empezar; si aún no hay nivel, pide elegirlo primero */
async function StartConversation() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("level")
    .eq("id", auth?.claims?.sub ?? "")
    .maybeSingle();

  if (!profile?.level) return <ChooseLevelNotice />;

  return (
    <form action={startFreeConversation}>
      <SubmitButton
        pendingText="Abriendo chat…"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-4 font-semibold text-white shadow-lg shadow-violet-500/30 transition-transform hover:-translate-y-0.5 sm:w-auto"
      >
        <Plus className="h-5 w-5" /> Nueva conversación · {profile.level}
      </SubmitButton>
    </form>
  );
}

