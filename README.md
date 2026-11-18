# English Buddy

Agente de IA para practicar inglés hablando y escribiendo. Hecho con Next.js (App Router), TypeScript, Tailwind CSS y Supabase, usando solo servicios con capa gratuita.

**App publicada:** <https://english-buddy-six-drab.vercel.app> (se puede instalar en el celular como app).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Estructura, login y perfil con nivel | ✅ |
| 2 | Chat con IA por texto (Groq y Gemini, con respaldo automático) | ✅ |
| 3 | Voz: dictado, escuchar respuestas y lectura automática (Web Speech API) | ✅ |
| 4 | Temas guiados (10 temas con nivel mínimo) y conversación libre | ✅ |
| 5 | 25 lecciones (ejercicios + escritura corregida por IA) y página de progreso | ✅ |
| 6 | PWA instalable (Serwist) y despliegue en Vercel | 🧪 en prueba |

## Puesta en marcha (Windows / PowerShell)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En Supabase → **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/` (`0001_profiles.sql` a `0004_lessons.sql`) y después `supabase/seed.sql` (10 temas y 25 lecciones; se puede volver a ejecutar sin duplicar).
3. En Supabase → **Authentication → URL Configuration**: *Site URL* = `http://localhost:3000` y agrega `http://localhost:3000/**` en *Redirect URLs*.
4. Copia las variables de entorno y complétalas con *Project Settings → API* (URL y clave publicable):

   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```

   Para el chat agrega al menos una clave de IA (gratis): `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey)) y, como respaldo, `GROQ_API_KEY` ([Groq](https://console.groq.com/keys)). `AI_PROVIDER` fija el orden (por ejemplo `groq,gemini`); si el primero falla o está saturado, la app usa el siguiente. `DAILY_MESSAGE_LIMIT` fija los mensajes por usuaria al día (30 por defecto).

5. Instala y arranca:

   ```powershell
   npm install
   npm run dev
   ```

6. Abre <http://localhost:3000>.

> **Voz:** el dictado usa el reconocimiento de voz del navegador y funciona mejor en **Chrome o Edge** (Firefox no lo trae). La primera vez el navegador pide permiso para usar el micrófono. Escuchar las respuestas funciona en todos los navegadores modernos, con las voces en inglés instaladas en el dispositivo.

## App instalable (PWA)

- `app/manifest.ts`: nombre, íconos (`public/icons/`), colores y `display: standalone`.
- Service worker con [Serwist](https://serwist.pages.dev): `app/sw.ts` (se sirve en `/serwist/sw.js`). Guarda la app y las páginas visitadas (por ejemplo, las lecciones) para abrirlas sin internet; la IA y Supabase nunca se guardan. En desarrollo está desactivado: para probarlo usa `npm run build` y `npm run start`.
- `/~offline`: página cuando no hay conexión. `/instalar`: guía para Android, iPhone y computador. En Inicio aparece la tarjeta "Instala English Buddy".
- Al cerrar sesión se borran las páginas guardadas en el equipo.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en [vercel.com/new](https://vercel.com/new) (framework: Next.js, sin cambios en build).
2. En *Settings → Environment Variables* agrega las mismas variables de `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, `DAILY_MESSAGE_LIMIT` (y opcionalmente `GROQ_MODEL`, `GEMINI_MODEL`). Luego *Redeploy*.
3. En Supabase → **Authentication → URL Configuration**: *Site URL* = tu dominio de Vercel (por ejemplo `https://english-buddy.vercel.app`) y agrega `https://english-buddy.vercel.app/**` en *Redirect URLs* (deja también `http://localhost:3000/**` para desarrollo).
4. Abre la app en el celular y prueba instalarla.

> Durante el desarrollo *Confirm email* está **desactivado** (Supabase → Authentication → Sign In / Providers). Motivos: el correo integrado de Supabase permite muy pocos envíos por hora, y los antivirus de correo (Outlook, correos universitarios) abren el enlace antes que la usuaria y lo dejan vencido (`otp_expired`).
>
> **Pendiente para la Fase 6:** configurar un SMTP gratuito (por ejemplo Resend), volver a activar *Confirm email* y usar una página de confirmación con botón, para que el antivirus no gaste el enlace.

## Estructura

```
app/
  (app)/            páginas con sesión: inicio, temas, libre, chat/[id], lecciones, progreso
                    (temas/ y libre/ tienen sus server actions para abrir conversaciones)
  api/chat          responde con la IA, guarda mensajes y aplica el límite diario
  api/translate     traduce la última respuesta (y la guarda)
  api/lesson-writing  la IA califica (1-10) el ejercicio de escritura de una lección
  login/            inicio de sesión
  auth/             registro, confirmación de correo, recuperar contraseña
components/         UI (shadcn/ui) y navegación
lib/
  supabase/         clientes de Supabase (navegador, servidor, proxy)
  ai.ts             capa de IA (Gemini / Groq con respaldo automático)
  tutor.ts          personalidad de la agente (system prompt) y validación del JSON
  chat.ts           tipos y límites del chat
  speech.ts         voz: dictado (SpeechRecognition) y lectura (SpeechSynthesis)
  lessons.ts        tipos de ejercicios y corrección automática (en el servidor)
  progress.ts       totales de progreso
  i18n.ts           textos de la interfaz (español primero)
  levels.ts         niveles A1–C1
supabase/migrations SQL de la base de datos
supabase/seed.sql   datos iniciales (temas guiados y lecciones)
proxy.ts            protege las rutas: sin sesión → /login
```

## Créditos y licencias

- Plantilla base: [Next.js + Supabase Starter](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) de Vercel — licencia MIT.
- Componentes de interfaz: [shadcn/ui](https://github.com/shadcn-ui/ui) — licencia MIT.
- Íconos: [Lucide](https://github.com/lucide-icons/lucide) — licencia ISC.
- PWA / service worker: [Serwist](https://github.com/serwist/serwist) — licencia MIT.
