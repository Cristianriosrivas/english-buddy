import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/chat-view";
import { dailyMessageLimit, MESSAGE_COLUMNS, todayUTC, type ChatRow } from "@/lib/chat";

export const metadata = { title: "Chat" };

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatLoader params={params} />
    </Suspense>
  );
}

async function ChatLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub ?? "";

  const [{ data: conversation }, { data: messages }, { data: usage }] = await Promise.all([
    supabase.from("conversations").select("id, mode, level, title").eq("id", id).maybeSingle(),
    supabase.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", id).order("created_at"),
    supabase.from("usage_daily").select("messages").eq("user_id", userId).eq("day", todayUTC()).maybeSingle(),
  ]);
  if (!conversation) notFound();

  const limit = dailyMessageLimit();
  return (
    <ChatView
      conversationId={conversation.id}
      title={
        conversation.mode === "topic"
          ? `Tema: ${conversation.title ?? "guiado"}`
          : conversation.mode === "free"
            ? "Conversación libre"
            : (conversation.title ?? "Conversación")
      }
      level={conversation.level}
      backHref={conversation.mode === "topic" ? "/temas" : "/libre"}
      initialMessages={(messages ?? []) as ChatRow[]}
      initialRemaining={Math.max(limit - (usage?.messages ?? 0), 0)}
      dailyLimit={limit}
    />
  );
}

function ChatSkeleton() {
  return (
    <div aria-busy className="flex h-[calc(100svh-12rem)] flex-col gap-3 md:h-[calc(100svh-8rem)]">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-muted" />
      <div className="glass flex-1 animate-pulse rounded-2xl" />
      <div className="glass h-11 animate-pulse rounded-2xl" />
    </div>
  );
}
