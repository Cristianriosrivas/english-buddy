"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLevel } from "@/lib/levels";

/** Guarda el nivel elegido en el perfil de la usuaria actual */
export async function setLevel(formData: FormData) {
  const level = formData.get("level");
  if (!isLevel(level)) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  await supabase.from("profiles").update({ level }).eq("id", userId);
  revalidatePath("/");
}
