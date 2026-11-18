"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLevel } from "@/lib/levels";
import { openingMessage } from "@/lib/tutor";

/** Crea una conversación libre con el saludo de la agente y abre el chat */
export async function startFreeConversation() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("name, level").eq("id", userId).maybeSingle();
  if (!isLevel(profile?.level)) redirect("/"); // primero debe elegir su nivel

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ mode: "free", level: profile.level })
    .select("id")
    .single();
  if (error || !conversation) throw new Error("No se pudo crear la conversación");

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: openingMessage(profile.level, profile.name),
  });

  redirect(`/chat/${conversation.id}`);
}
