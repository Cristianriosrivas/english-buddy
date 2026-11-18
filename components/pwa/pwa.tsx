"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Download, Smartphone, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Instalación (evento beforeinstallprompt de Chrome / Edge / Android) ------
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notifyInstall = () => installListeners.forEach((listener) => listener());

// Se registra al cargar el módulo (lo importa el layout raíz) para no perder el evento
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyInstall();
  });
}

const subscribeInstall = (listener: () => void) => {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
};
const subscribeDisplayMode = (listener: () => void) => {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const noopSubscribe = () => () => {};

export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribeInstall, () => deferredPrompt !== null, () => false);
  const installed = useSyncExternalStore(
    subscribeDisplayMode,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
  const isIOS = useSyncExternalStore(
    noopSubscribe,
    () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    () => false,
  );

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyInstall();
  }

  return { canPrompt, installed, isIOS, install };
}

/** Botón "Instalar app" (solo aparece cuando el navegador lo permite) */
export function InstallButton({ className }: { className?: string }) {
  const { canPrompt, installed, install } = useInstallPrompt();
  if (installed) {
    return <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">✓ La app ya está instalada.</p>;
  }
  if (!canPrompt) return null;
  return (
    <button
      type="button"
      onClick={install}
      className={cn(
        "flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:-translate-y-0.5",
        className,
      )}
    >
      <Download className="h-4 w-4" /> Instalar app
    </button>
  );
}

/** Tarjeta en Inicio para invitar a instalar la app (se oculta si ya está instalada) */
export function InstallCard() {
  const { installed, isIOS } = useInstallPrompt();
  if (installed) return null;
  return (
    <section className="glass flex flex-wrap items-center gap-4 rounded-2xl p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-400 text-white shadow-lg">
        <Smartphone className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Instala English Buddy en tu celular</h2>
        <p className="text-sm text-muted-foreground">
          {isIOS
            ? "En Safari: botón Compartir → “Agregar a pantalla de inicio”."
            : "Ábrela como una app, desde un ícono en tu pantalla de inicio."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <InstallButton />
        <Link href="/instalar" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Cómo instalarla
        </Link>
      </div>
    </section>
  );
}

// --- Aviso sin conexión ----------------------------------------------------
const subscribeOnline = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-16 z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-amber-400/60 bg-amber-50/95 px-4 py-2.5 text-sm text-amber-900 shadow-lg backdrop-blur duration-300 animate-in fade-in slide-in-from-top-2 dark:bg-amber-950/90 dark:text-amber-100"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Sin conexión: puedes repasar las lecciones que ya abriste.
    </div>
  );
}
