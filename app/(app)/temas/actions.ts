"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLevel, meetsLevel } from "@/lib/levels";
import { topicOpening } from "@/lib/tutor";

/** Crea una conversación sobre un tema: la agente la inicia con el saludo del tema */
export async function startTopicConversation(formData: FormData) {
  const topicId = String(formData.get("topicId") ?? "");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: topic }] = await Promise.all([
    supabase.from("profiles").select("name, level").eq("id", userId).maybeSingle(),
    supabase.from("topics").select("id, name, min_level, opener").eq("id", topicId).maybeSingle(),
  ]);
  if (!isLevel(profile?.level)) redirect("/"); // primero debe elegir su nivel
  if (!topic || !isLevel(topic.min_level) || !meetsLevel(profile.level, topic.min_level)) redirect("/temas");

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ mode: "topic", topic: topic.id, level: profile.level, title: topic.name })
    .select("id")
    .single();
  if (error || !conversation) throw new Error("No se pudo crear la conversación");

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: topicOpening(topic.opener, profile.name),
  });

  redirect(`/chat/${conversation.id}`);
}
