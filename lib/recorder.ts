"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Grabación de voz para celulares: graba con MediaRecorder y transcribe en el servidor
 * (/api/transcribe, Whisper). Sustituye al dictado del navegador, que en iPhone pide
 * permiso cada vez y deja de funcionar después del primer uso.
 *
 * El micrófono se pide UNA vez y se reutiliza para todos los audios mientras la usuaria
 * está en el chat; se libera al salir de la pantalla o al pasar la app a segundo plano.
 */

const MAX_SECONDS = 60;
const MIN_MS = 600;

let sharedStream: MediaStream | null = null;

async function getMicrophone() {
  if (sharedStream?.getAudioTracks().some((t) => t.readyState === "live")) return sharedStream;
  sharedStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  return sharedStream;
}

function releaseMicrophone() {
  sharedStream?.getTracks().forEach((t) => t.stop());
  sharedStream = null;
}

/** Formato que soporte el navegador (iPhone: mp4/AAC; Chrome y Android: webm/Opus) */
function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) ?? "";
}

function micErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permite el uso del micrófono para poder hablar (en iPhone: Ajustes → Apps → Safari → Micrófono).";
  }
  if (name === "NotFoundError") return "No encontré un micrófono en este dispositivo.";
  return "No pude usar el micrófono. Inténtalo de nuevo.";
}

const noopSubscribe = () => () => {};

export function useAudioRecorder({ onText }: { onText: (text: string) => void }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined",
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  /** Termina y descarta el audio (por ejemplo, si la usuaria escribe o envía) */
  const cancel = useCallback(() => {
    discardRef.current = true;
    stop();
  }, [stop]);

  // Soltar el micrófono al salir del chat o al pasar a segundo plano
  // (iOS lo corta igual en segundo plano; así no queda encendido)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMicrophone();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMicrophone();
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Tu navegador no permite grabar audio.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await getMicrophone();
    } catch (e) {
      setError(micErrorMessage(e));
      return;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError("No pude empezar a grabar. Inténtalo de nuevo.");
      return;
    }

    const chunks: Blob[] = [];
    const startedAt = Date.now();
    discardRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      clearTimeout(timerRef.current);
      if (recorderRef.current === recorder) recorderRef.current = null;
      setListening(false);
      if (discardRef.current) return;
      if (Date.now() - startedAt < MIN_MS || chunks.length === 0) {
        setError("El audio fue muy corto. Toca el micrófono, habla y toca ■ al terminar.");
        return;
      }

      setTranscribing(true);
      try {
        const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", audio);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.text !== "string") throw new Error(data.error ?? "No pude entender el audio.");
        onTextRef.current(data.text);
      } catch (e) {
        setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No hay conexión. Inténtalo de nuevo.");
      } finally {
        setTranscribing(false);
      }
    };

    recorder.start();
    recorderRef.current = recorder;
    setListening(true);
    // Límite de duración para no pasar el tamaño máximo
    timerRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_SECONDS * 1000);
  }, [supported]);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, hearing: listening, transcribing, error, start, stop, cancel, clearError };
}
