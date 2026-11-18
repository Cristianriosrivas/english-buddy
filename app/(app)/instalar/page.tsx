import { Monitor, Smartphone } from "lucide-react";
import { InstallButton } from "@/components/pwa/pwa";

export const metadata = { title: "Instalar la app" };

const GUIDES = [
  {
    title: "Android (Chrome)",
    icon: Smartphone,
    steps: [
      "Abre English Buddy en Chrome.",
      "Toca el botón “Instalar app” de esta página o, si no aparece, el menú ⋮ de arriba a la derecha.",
      "Elige “Instalar app” o “Agregar a la pantalla principal” y confirma.",
      "Busca el ícono EB en tu pantalla de inicio: se abre como una app, sin la barra del navegador.",
    ],
  },
  {
    title: "iPhone y iPad (Safari)",
    icon: Smartphone,
    steps: [
      "Abre English Buddy en Safari (en otros navegadores de iPhone no se puede instalar).",
      "Toca el botón Compartir (el cuadrado con una flecha hacia arriba) en la barra de abajo.",
      "Desliza y elige “Agregar a pantalla de inicio”.",
      "Toca “Agregar”. El ícono EB aparecerá junto a tus otras apps.",
    ],
  },
  {
    title: "Computador (Chrome o Edge)",
    icon: Monitor,
    steps: [
      "Haz clic en el ícono de instalar que aparece a la derecha de la barra de direcciones.",
      "O usa el botón “Instalar app” de esta página.",
    ],
  },
];

export default function InstalarPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Instala la app</h1>
        <p className="text-muted-foreground">
          English Buddy funciona como una app en tu celular: se abre desde un ícono, a pantalla completa, y las
          lecciones que ya abriste se pueden repasar sin internet.
        </p>
        <InstallButton className="self-start" />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {GUIDES.map(({ title, icon: Icon, steps }) => (
          <section key={title} className="glass rounded-2xl p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Icon className="h-5 w-5 text-primary" /> {title}
            </h2>
            <ol className="grid gap-2 text-sm">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
