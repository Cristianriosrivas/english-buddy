"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Languages, Loader2, Mic, Phone, SendHorizontal, Square, Volume2, VolumeX } from "lucide-react";
import { MAX_MESSAGE_CHARS, TUTOR_NAME, type ChatRow } from "@/lib/chat";
import { useAutoRead, useSpeechSynthesis, useVoiceInput } from "@/lib/speech";
import { speechRateFor } from "@/lib/levels";
import { useLiveCall, type LiveTurnResult } from "@/lib/live-call";
import { CorrectionCard } from "@/components/chat/correction-card";
import { LiveCallOverlay } from "@/components/chat/live-call-overlay";
import { cn } from "@/lib/utils";

/** Agrega el texto dictado a lo que ya estaba escrito */
function appendText(base: string, spoken: string) {
  return [base.trim(), spoken].filter(Boolean).join(" ").slice(0, MAX_MESSAGE_CHARS);
}

type Props = {
  conversationId: string;
  title: string;
  level: string;
  backHref: string;
  initialMessages: ChatRow[];
  initialRemaining: number;
  dailyLimit: number;
};

export function ChatView({
  conversationId,
  title,
  level,
  backHref,
  initialMessages,
  initialRemaining,
  dailyLimit,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dictationBaseRef = useRef("");

  const tts = useSpeechSynthesis({ rate: speechRateFor(level) });
  const [autoRead, setAutoRead] = useAutoRead();
  // PC: dictado en vivo · celular: grabar y transcribir (permiso una sola vez)
  const mic = useVoiceInput({
    onText: (spoken) => setInput(appendText(dictationBaseRef.current, spoken)),
  });

  const limitReached = remaining <= 0;
  const lastAssistantId = messages.findLast((m) => m.role === "assistant")?.id;
  const shownError = error ?? mic.error;

  function toggleMic() {
    if (mic.listening) {
      mic.stop();
      return;
    }
    tts.stop(); // que el micrófono no escuche a Emma
    setError(null);
    dictationBaseRef.current = input;
    mic.start();
  }

  function toggleSpeak(message: ChatRow) {
    if (tts.speakingId === message.id) {
      tts.stop();
      return;
    }
    mic.cancel();
    tts.speak(message.content, message.id);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending, translatingId]);

  /** Envía un mensaje a la agente y agrega ambos mensajes al chat (lo usan el texto y la llamada) */
  async function requestReply(
    text: string,
    voice: boolean,
  ): Promise<{ reply?: ChatRow; mine?: ChatRow; error?: string; limitReached?: boolean }> {
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", content: text, corrections: [], translation: null, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, voice }),
      });
      const data = await res.json().catch(() => ({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }));
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (data.limitReached) setRemaining(0);
        return { error: data.error ?? "Ocurrió un error. Inténtalo de nuevo.", limitReached: Boolean(data.limitReached) };
      }
      const saved = data.messages as ChatRow[];
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), ...saved]);
      setRemaining(data.remaining);
      return { reply: saved.findLast((m) => m.role === "assistant"), mine: saved.find((m) => m.role === "user") };
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return { error: "No hay conexión. Revisa tu internet e inténtalo de nuevo." };
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || limitReached) return;

    mic.cancel(); // se envía lo que se ve en el campo
    mic.clearError();
    tts.stop();
    setSending(true);
    setError(null);
    setInput("");
    const result = await requestReply(text, false);
    if (result.error) {
      setInput(text);
      setError(result.error);
    } else if (autoRead && result.reply) {
      tts.speak(result.reply.content, result.reply.id);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  // --- Llamada en vivo ---
  const [callOpen, setCallOpen] = useState(false);
  const live = useLiveCall({
    rate: speechRateFor(level),
    onUserText: async (text): Promise<LiveTurnResult> => {
      setSending(true);
      const result = await requestReply(text, true);
      setSending(false);
      return {
        reply: result.reply?.content,
        corrections: result.mine?.corrections ?? [],
        error: result.error,
        stop: result.limitReached,
      };
    },
  });

  function startCall() {
    tts.stop();
    mic.cancel();
    setError(null);
    setCallOpen(true);
    void live.start(); // dentro del toque: iOS lo exige para el micrófono y la voz
  }

  function hangUp() {
    live.end();
    setCallOpen(false);
  }

  async function translate(messageId: string) {
    setTranslatingId(messageId);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.translation) throw new Error(data.error ?? "No pude traducir el mensaje.");
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, translation: data.translation } : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude traducir el mensaje.");
    } finally {
      setTranslatingId(null);
    }
  }

  return (
    <div className="flex h-[calc(100svh-12rem)] flex-col md:h-[calc(100svh-8rem)]">
      <header className="flex items-center gap-3 pb-3">
        <Link
          href={backHref}
          aria-label="Volver"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 font-semibold text-white shadow-lg shadow-violet-500/30"
        >
          {TUTOR_NAME[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold leading-tight">{TUTOR_NAME}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {title} · Nivel {level}
          </p>
        </div>
        <span
          title="Mensajes que te quedan hoy"
          className={cn(
            "glass shrink-0 rounded-full px-3 py-1 text-xs tabular-nums",
            remaining <= 5 && "text-amber-600 dark:text-amber-400",
          )}
        >
          {remaining}/{dailyLimit} hoy
        </span>
        {tts.supported && (
          <button
            type="button"
            onClick={() => {
              if (autoRead) tts.stop();
              setAutoRead(!autoRead);
            }}
            aria-pressed={autoRead}
            title={autoRead ? "Lectura automática activada" : "Lectura automática desactivada"}
            aria-label="Leer automáticamente las respuestas"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors",
              autoRead ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
            )}
          >
            {autoRead ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        )}
        <button
          type="button"
          onClick={startCall}
          disabled={limitReached}
          title={`Hablar en vivo con ${TUTOR_NAME}`}
          aria-label={`Llamar a ${TUTOR_NAME}: conversación por voz en vivo`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
        >
          <Phone className="h-4 w-4" />
          <span className="hidden sm:inline">Llamar</span>
        </button>
      </header>

      {callOpen && <LiveCallOverlay live={live} level={level} onHangUp={hangUp} />}

      <div role="log" aria-live="polite" className="glass flex-1 space-y-4 overflow-y-auto rounded-2xl p-3 sm:p-4">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            canTranslate={message.id === lastAssistantId}
            translating={translatingId === message.id}
            onTranslate={() => translate(message.id)}
            canSpeak={tts.supported}
            speaking={tts.speakingId === message.id}
            onSpeak={() => toggleSpeak(message)}
          />
        ))}
        {sending && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {shownError && (
        <p role="alert" className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
          {shownError}
        </p>
      )}

      {mic.listening && (
        <p aria-live="polite" className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <VoiceWave hearing={mic.hearing} />
          {mic.mode === "record" ? "Grabando… habla en inglés y" : "Escuchando en inglés…"} toca{" "}
          <Square className="inline h-2.5 w-2.5 fill-current" /> para terminar
        </p>
      )}
      {mic.transcribing && (
        <p aria-live="polite" className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Convirtiendo tu audio en texto…
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <button
          type="button"
          onClick={toggleMic}
          disabled={sending || limitReached || mic.transcribing}
          aria-pressed={mic.listening}
          aria-label={mic.listening ? "Terminar de dictar" : "Hablar en inglés"}
          title={mic.listening ? "Terminar de dictar" : "Hablar en inglés"}
          className={cn(
            "relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40",
            mic.listening
              ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
              : "glass text-muted-foreground hover:text-primary",
          )}
        >
          {mic.listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
          {mic.transcribing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mic.listening ? (
            <Square className="relative h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>
        <label className="glass flex min-h-11 flex-1 items-center rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-ring">
          <span className="sr-only">Tu mensaje</span>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={limitReached}
            placeholder={
              limitReached ? "Límite de hoy alcanzado" : mic.listening ? "Speak in English…" : "Write in English…"
            }
            onChange={(e) => {
              if (mic.listening) mic.cancel(); // escribir a mano detiene el dictado
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-32 flex-1 resize-none bg-transparent text-[15px] outline-none [field-sizing:content] placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </label>
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!input.trim() || sending || limitReached || mic.transcribing}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:shadow-none"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

function MessageItem({
  message,
  canTranslate,
  translating,
  onTranslate,
  canSpeak,
  speaking,
  onSpeak,
}: {
  message: ChatRow;
  canTranslate: boolean;
  translating: boolean;
  onTranslate: () => void;
  canSpeak: boolean;
  speaking: boolean;
  onSpeak: () => void;
}) {
  const mine = message.role === "user";
  const showTranslate = !mine && canTranslate && !message.translation;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 duration-300 animate-in fade-in slide-in-from-bottom-2",
        mine ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-background/80 dark:bg-white/10",
          message.id.startsWith("temp-") && "opacity-70",
          speaking && "ring-2 ring-primary/50",
        )}
      >
        {message.content}
      </div>

      {message.translation && (
        <p className="max-w-[85%] px-1 text-sm italic text-muted-foreground">{message.translation}</p>
      )}

      {!mine && (canSpeak || showTranslate) && (
        <div className="flex items-center gap-4 px-1">
          {canSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              aria-pressed={speaking}
              className={cn(
                "flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary",
                speaking && "text-primary",
              )}
            >
              {speaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
              {speaking ? "Detener" : "Escuchar"}
            </button>
          )}
          {showTranslate && (
            <button
              type="button"
              onClick={onTranslate}
              disabled={translating}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
            >
              <Languages className="h-3.5 w-3.5" />
              {translating ? "Traduciendo…" : "Traducir al español"}
            </button>
          )}
        </div>
      )}

      {mine && message.corrections.length > 0 && (
        <CorrectionCard corrections={message.corrections} className="max-w-[85%]" />
      )}
    </div>
  );
}

/** Onda animada mientras se escucha; se mueve más cuando detecta voz */
function VoiceWave({ hearing }: { hearing: boolean }) {
  return (
    <span aria-hidden data-hearing={hearing} className="voice-wave flex h-4 items-center gap-0.5">
      {[0, 120, 240, 120, 0].map((delay, i) => (
        <span key={i} className="h-full w-1 rounded-full bg-red-500" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start duration-300 animate-in fade-in">
      <div
        aria-label={`${TUTOR_NAME} está escribiendo`}
        className="flex gap-1 rounded-2xl rounded-bl-md border bg-background/80 px-4 py-3.5 dark:bg-white/10"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
