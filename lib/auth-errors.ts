// Traduce los mensajes más comunes de Supabase Auth al español
const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos"],
  [/email not confirmed/i, "Primero confirma tu correo con el enlace que te enviamos"],
  [/user already registered/i, "Ya existe una cuenta con ese correo"],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres"],
  [/rate limit|too many requests/i, "Demasiados intentos. Espera unos minutos y vuelve a probar"],
  [/unable to validate email|invalid email/i, "El correo no es válido"],
  [/failed to fetch|network/i, "No hay conexión con el servidor. Revisa tu internet"],
];

export function translateAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = MESSAGES.find(([pattern]) => pattern.test(message));
  return match ? match[1] : "Ocurrió un error. Inténtalo de nuevo";
}
