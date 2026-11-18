import { WifiOff } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { RetryButton } from "@/components/pwa/retry-button";

export const metadata = { title: "Sin conexión" };

/** Se muestra cuando no hay internet y la página pedida no está guardada */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <BrandLogo />
      <div className="glass flex max-w-sm flex-col items-center gap-3 rounded-2xl p-6">
        <WifiOff className="h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">Estás sin conexión</h1>
        <p className="text-sm text-muted-foreground">
          Las lecciones que ya abriste siguen disponibles. Hablar con Emma, corregir ejercicios y la escritura
          necesitan internet.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
