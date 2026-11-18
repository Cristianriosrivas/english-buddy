"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Borra las páginas guardadas sin conexión para que otra persona no las vea en este equipo
    // (se conserva solo la base de la app y la página sin conexión)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.includes("precache")).map((key) => caches.delete(key)));
    }
    router.push("/login");
  };

  return <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>;
}
