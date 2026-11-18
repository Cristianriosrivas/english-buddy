import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  // Solo rutas internas, para evitar redirecciones a otros sitios
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  // Supabase rechazó el enlace antes de llegar aquí (vencido o ya usado)
  const errorCode = searchParams.get("error_code");
  if (errorCode) {
    const message =
      errorCode === "otp_expired"
        ? "El enlace venció o ya fue usado. Intenta iniciar sesión; si no puedes, regístrate de nuevo para recibir otro."
        : "No pudimos validar el enlace del correo.";
    redirect(`/auth/error?error=${encodeURIComponent(message)}`);
  }

  // Plantilla de correo por defecto de Supabase (flujo PKCE): llega ?code=
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // redirect user to specified redirect URL or root of app
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
