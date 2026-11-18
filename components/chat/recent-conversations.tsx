import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  title: string | null;
  level: string;
  updated_at: string;
  topics: { emoji: string } | null;
};

/** Últimas conversaciones de la usuaria en un modo (libre o por tema) */
export async function RecentConversations({ mode, limit = 15 }: { mode: "free" | "topic"; limit?: number }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, title, level, updated_at, topics(emoji)")
    .eq("mode", mode)
    .order("updated_at", { ascending: false })
    .limit(limit);
  const conversations = (data ?? []) as unknown as Row[];

  if (!conversations.length) {
    return (
      <p className="glass rounded-2xl p-5 text-sm text-muted-foreground">
        Aún no tienes conversaciones. ¡Empieza una!
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            href={`/chat/${c.id}`}
            className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-primary/50"
          >
            {c.topics?.emoji ? (
              <span aria-hidden className="w-5 shrink-0 text-center text-lg leading-none">
                {c.topics.emoji}
              </span>
            ) : (
              <MessageCircle className="h-5 w-5 shrink-0 text-sky-500" />
            )}
            <span className="min-w-0 flex-1 truncate">{c.title ?? "Conversación nueva"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {c.level} ·{" "}
              {new Date(c.updated_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
