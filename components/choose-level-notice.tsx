import Link from "next/link";
import { TUTOR_NAME } from "@/lib/chat";

/** Aviso para quien aún no eligió su nivel */
export function ChooseLevelNotice() {
  return (
    <p className="glass rounded-2xl p-4 text-sm">
      Primero{" "}
      <Link href="/" className="font-medium text-primary underline underline-offset-4">
        elige tu nivel en Inicio
      </Link>{" "}
      para que {TUTOR_NAME} adapte la conversación.
    </p>
  );
}
