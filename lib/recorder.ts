"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { encodeWav, micCapture, micErrorMessage, transcribeWav } from "@/lib/voice-capture";

/*
 * Dictado por grabación (celulares): toca para grabar, toca ■ para terminar y el texto
 * aparece en el campo. Graba en WAV con Web Audio y transcribe con Whisper en el servidor.
 * El micrófono se pide una vez y se reutiliza mientras la usuaria está en el chat.
 */

const MAX_MS = 60_000;
const MIN_MS = 600;

const noopSubscribe = () => () => {};

export function useAudioRecorder({ onText }: { onText: (text: string) => void }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(navigator.mediaDevices?.getUserMedia) && ("AudioContext" in window || "webkitAudioContext" in window),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  const detach = useCallback(() => {
    clearTimeout(timerRef.current);
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setListening(false);
  }, []);

  /** Termina la grabación y transcribe */
  const stop = useCallback(async () => {
    if (!unsubscribeRef.current) return;
    detach();
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (Date.now() - startedAtRef.current < MIN_MS || chunks.length === 0) {
      setError("El audio fue muy corto. Toca el micrófono, habla y toca ■ al terminar.");
      return;
    }
    setTranscribing(true);
    try {
      onTextRef.current(await transcribeWav(encodeWav(chunks, micCapture.sampleRate)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude entender el audio.");
    } finally {
      setTranscribing(false);
    }
  }, [detach]);

  /** Termina y descarta el audio (por ejemplo, si la usuaria escribe o envía) */
  const cancel = useCallback(() => {
    detach();
    chunksRef.current = [];
  }, [detach]);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Tu navegador no permite grabar audio.");
      return;
    }
    try {
      await micCapture.open();
    } catch (e) {
      setError(micErrorMessage(e));
      return;
    }
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    unsubscribeRef.current = micCapture.subscribe((frame) => chunksRef.current.push(frame));
    setListening(true);
    timerRef.current = setTimeout(() => void stop(), MAX_MS);
  }, [supported, stop]);

  // Al salir del chat o pasar a segundo plano se apaga el micrófono
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      cancel();
      micCapture.close();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancel();
      micCapture.close();
    };
  }, [cancel]);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, hearing: listening, transcribing, error, start, stop, cancel, clearError };
}
