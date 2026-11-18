"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/** Botón de formulario que se desactiva y cambia de texto mientras se envía */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  /** Texto mientras se envía; si no se indica, se mantiene el contenido (con aria-busy) */
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn(className, pending && "opacity-70")}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
