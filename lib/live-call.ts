"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Correction } from "@/lib/tutor";
import { speakOnce, unlockSpeechSynthesis } from "@/lib/speech";
import { encodeWav, micCapture, micErrorMessage, transcribeWav, TranscribeError } from "@/lib/voice-capture";

/*
 * Llamada en vivo con la agente (tipo "Gemini Live"), 100 % gratis:
 *   escuchar (detección de voz en el navegador) → Whisper (Groq) → respuesta (Groq)
 *   → voz del teléfono (speechSynthesis) → volver a escuchar.
 * Mientras la agente habla no se escucha el micrófono, para que no se oiga a sí misma.
 */

export type LivePhase = "idle" | "connecting" | "listening" | "transcribing" | "thinking" | "speaking" | "paused" | "ended";

export type LiveTurnResult = {
  reply?: string;
  corrections?: Correction[];
  error?: string;
  /** true si ya no se puede seguir (por ejemplo, se acabó el límite diario) */
  stop?: boolean;
};

// Detección de voz (VAD) por volumen
const START_FRAMES = 3; // ~130 ms por encima del umbral para empezar a grabar
const END_SILENCE_MS = 1100; // una pausa así marca el final de la frase
const MIN_SPEECH_MS = 350; // ignorar golpes o ruidos cortos
const MAX_UTTERANCE_MS = 30_000;
const PRE_ROLL_FRAMES = 8; // ~340 ms antes de detectar la voz (para no cortar la primera sílaba)
const MIN_THRESHOLD = 0.012;

type VadState = {
  noise: number;
  active: boolean;
  speechFrames: number;
  speechMs: number;
  silenceMs: number;
  totalMs: number;
  chunks: Float32Array[];
  preRoll: Float32Array[];
};

const freshVad = (noise = 0.008): VadState => ({
  noise,
  active: false,
  speechFrames: 0,
  speechMs: 0,
  silenceMs: 0,
  totalMs: 0,
  chunks: [],
  preRoll: [],
});

export function useLiveCall({
  rate,
  onUserText,
}: {
  rate: number;
  onUserText: (text: string) => Promise<LiveTurnResult>;
}) {
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [level, setLevel] = useState(0);
  const [userText, setUserText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<LivePhase>("idle");
  const vadRef = useRef<VadState>(freshVad());
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const speechRef = useRef<{ cancel: () => void } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastLevelAtRef = useRef(0);
  const onUserTextRef = useRef(onUserText);
  const onFrameRef = useRef<(frame: Float32Array, rms: number) => void>(() => {});

  useEffect(() => {
    onUserTextRef.current = onUserText;
  });

  const goTo = useCallback((next: LivePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const listen = useCallback(async () => {
    vadRef.current = freshVad(vadRef.current.noise);
    const running = await micCapture.ensureRunning();
    if (phaseRef.current === "ended") return;
    if (!running) {
      // iOS pausó el audio: hace falta un toque para seguir
      goTo("paused");
      setError("Toca el micrófono para seguir hablando.");
      return;
    }
    goTo("listening");
  }, [goTo]);

  const end = useCallback(() => {
    goTo("ended");
    speechRef.current?.cancel();
    speechRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    micCapture.close(); // al colgar se apaga el micrófono
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    vadRef.current = freshVad();
    setLevel(0);
  }, [goTo]);

  const handleUtterance = useCallback(
    async (chunks: Float32Array[]) => {
      // La fase cambia entre awaits (colgar, pausar): siempre se lee la actual
      const now = (): LivePhase => phaseRef.current;
      goTo("transcribing");
      let text = "";
      try {
        text = (await transcribeWav(encodeWav(chunks, micCapture.sampleRate))).trim();
      } catch (e) {
        // 422 = no se entendió nada: simplemente se sigue escuchando
        if (!(e instanceof TranscribeError && e.status === 422)) {
          setError(e instanceof Error ? e.message : "No pude entender el audio.");
        }
      }
      if (now() !== "transcribing") return; // colgó o pausó mientras tanto
      if (!text) {
        void listen();
        return;
      }

      setUserText(text);
      setReplyText("");
      setCorrections([]);
      setError(null);
      goTo("thinking");
      const result = await onUserTextRef.current(text);
      if (now() !== "thinking") return;
      setCorrections(result.corrections ?? []);
      if (!result.reply) {
        setError(result.error ?? "No pude responder. Inténtalo de nuevo.");
        if (result.stop) end();
        else void listen();
        return;
      }

      setReplyText(result.reply);
      goTo("speaking");
      const speech = speakOnce(result.reply, { rate });
      speechRef.current = speech;
      await speech.done;
      speechRef.current = null;
      if (now() !== "speaking") return;
      // Pequeña espera para no captar el final de su propia voz
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (now() === "speaking") void listen();
    },
    [end, goTo, listen, rate],
  );

  // Se procesa cada fragmento de audio (~43 ms)
  const onFrame = (frame: Float32Array, rms: number) => {
    const now = performance.now();
    if (now - lastLevelAtRef.current > 90) {
      lastLevelAtRef.current = now;
      setLevel(phaseRef.current === "listening" ? Math.min(1, rms * 12) : 0);
    }
    if (phaseRef.current !== "listening") return;

    const vad = vadRef.current;
    const frameMs = micCapture.frameMs;
    const threshold = Math.max(MIN_THRESHOLD, vad.noise * 2.5);

    if (!vad.active) {
      vad.preRoll.push(frame);
      if (vad.preRoll.length > PRE_ROLL_FRAMES) vad.preRoll.shift();
      if (rms > threshold) {
        vad.speechFrames++;
        if (vad.speechFrames >= START_FRAMES) {
          vad.active = true;
          vad.chunks = [...vad.preRoll];
          vad.speechMs = vad.speechFrames * frameMs;
          vad.silenceMs = 0;
          vad.totalMs = vad.chunks.length * frameMs;
        }
      } else {
        vad.speechFrames = 0;
        vad.noise = vad.noise * 0.95 + rms * 0.05; // el ruido de fondo se ajusta solo
      }
      return;
    }

    vad.chunks.push(frame);
    vad.totalMs += frameMs;
    if (rms > threshold * 0.8) {
      vad.speechMs += frameMs;
      vad.silenceMs = 0;
    } else {
      vad.silenceMs += frameMs;
    }
    if (vad.silenceMs >= END_SILENCE_MS || vad.totalMs >= MAX_UTTERANCE_MS) {
      const { chunks, speechMs } = vad;
      vadRef.current = freshVad(vad.noise);
      if (speechMs >= MIN_SPEECH_MS) void handleUtterance(chunks);
    }
  };

  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  /** Inicia la llamada. Debe llamarse desde un toque (iOS lo exige para micrófono y voz). */
  const start = useCallback(async () => {
    setError(null);
    setUserText("");
    setReplyText("");
    setCorrections([]);
    goTo("connecting");
    unlockSpeechSynthesis();
    try {
      await micCapture.open();
    } catch (e) {
      setError(micErrorMessage(e));
      goTo("ended");
      return;
    }
    unsubscribeRef.current?.();
    unsubscribeRef.current = micCapture.subscribe((frame, rms) => onFrameRef.current(frame, rms));
    try {
      // Que la pantalla no se apague durante la llamada
      wakeLockRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // No disponible: no pasa nada
    }
    void listen();
  }, [goTo, listen]);

  /** Pausar / seguir escuchando (botón del micrófono) */
  const togglePause = useCallback(() => {
    if (phaseRef.current === "paused") {
      setError(null);
      void listen();
    } else if (phaseRef.current === "listening") {
      vadRef.current = freshVad(vadRef.current.noise);
      goTo("paused");
    }
  }, [goTo, listen]);

  /** Cortar a la agente mientras habla y volver a escuchar */
  const interrupt = useCallback(() => {
    if (phaseRef.current === "speaking") speechRef.current?.cancel();
  }, []);

  // Colgar al salir de la pantalla o al pasar la app a segundo plano
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && phaseRef.current !== "idle" && phaseRef.current !== "ended") end();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (phaseRef.current !== "idle" && phaseRef.current !== "ended") end();
    };
  }, [end]);

  return { phase, level, userText, replyText, corrections, error, start, end, togglePause, interrupt };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
