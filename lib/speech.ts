"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAudioRecorder } from "@/lib/recorder";

/*
 * Voz con la Web Speech API del navegador (gratis, sin servidor):
 * - SpeechRecognition: dictado en inglés (funciona mejor en Chrome y Edge).
 * - SpeechSynthesis: leer en voz alta las respuestas de la agente.
 */

// TypeScript no trae los tipos de SpeechRecognition: declaramos lo mínimo
type RecognitionEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onspeechstart: (() => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

export const UNSUPPORTED_MIC_MESSAGE =
  "Tu navegador no permite dictar por voz. Usa Chrome o Edge para hablar con el micrófono.";

const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "Permite el uso del micrófono en tu navegador para poder hablar.",
  "service-not-allowed": UNSUPPORTED_MIC_MESSAGE,
  "language-not-supported": UNSUPPORTED_MIC_MESSAGE,
  "audio-capture": "No encontré un micrófono. Revisa que esté conectado.",
  "no-speech": "No te escuché. Toca el micrófono e inténtalo de nuevo.",
  network: "El dictado por voz necesita conexión a internet.",
};

/** Une los resultados del dictado en un texto limpio */
function joinTranscript(results: RecognitionEvent["results"]) {
  const text = Array.from(results, (r) => r[0].transcript).join(" ").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Dictado por voz. `onText` recibe el texto reconocido en esta sesión
 * (se actualiza mientras la usuaria habla).
 */
export function useSpeechRecognition({ lang = "en-US", onText }: { lang?: string; onText: (text: string) => void }) {
  const supported = useSyncExternalStore(noopSubscribe, () => Boolean(getRecognitionCtor()), () => false);
  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  // Al salir de la pantalla, apagar el micrófono
  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError(UNSUPPORTED_MIC_MESSAGE);
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    // En Android el modo continuo repite frases: allí se escucha una frase por vez
    rec.continuous = !/Android/i.test(navigator.userAgent);
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onspeechstart = () => setHearing(true);
    rec.onresult = (e) => {
      setHearing(true);
      onTextRef.current(joinTranscript(e.results));
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setError(RECOGNITION_ERRORS[e.error] ?? "No pude usar el micrófono. Inténtalo de nuevo.");
    };
    rec.onend = () => {
      // Una sesión anterior que termina tarde no debe apagar la actual
      if (recRef.current !== rec) return;
      recRef.current = null;
      setListening(false);
      setHearing(false);
    };
    try {
      rec.start();
      recRef.current = rec;
      setError(null);
      setListening(true);
    } catch {
      setError("No pude activar el micrófono. Inténtalo de nuevo.");
    }
  }, [lang]);

  /** Termina y conserva lo dictado */
  const stop = useCallback(() => recRef.current?.stop(), []);
  /** Termina y descarta lo que falte por reconocer (por ejemplo, al enviar) */
  const cancel = useCallback(() => recRef.current?.abort(), []);
  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, hearing, error, start, stop, cancel, clearError };
}

// --- Entrada de voz según el dispositivo --------------------------------------

/** Celulares y tablets (incluye iPad, que se presenta como Mac) */
function isMobileDevice() {
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Micrófono para el chat. En PC (Chrome/Edge) usa el dictado del navegador, con texto
 * en vivo. En celulares, o si el navegador no tiene dictado, graba el audio y lo
 * transcribe en el servidor con Whisper: pide permiso una vez y funciona en iPhone.
 */
export function useVoiceInput({ onText }: { onText: (text: string) => void }) {
  const useRecorder = useSyncExternalStore(
    noopSubscribe,
    () => isMobileDevice() || !getRecognitionCtor(),
    () => false,
  );
  const live = useSpeechRecognition({ onText });
  const recorder = useAudioRecorder({ onText });
  return useRecorder
    ? { ...recorder, mode: "record" as const }
    : { ...live, transcribing: false, mode: "live" as const };
}

// --- Lectura en voz alta ------------------------------------------------------

// Voces femeninas de EE. UU. que suenan naturales (Chrome, Edge, Safari/macOS/iOS, Windows)
const PREFERRED_VOICES = [
  /Google US English/i,
  /Microsoft (Emma|Aria|Jenny|Ava).*Natural/i,
  /Samantha/i,
  /Microsoft (Aria|Jenny|Zira)/i,
];

function pickVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const sameLang = voices.filter((v) => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  for (const pattern of PREFERRED_VOICES) {
    const voice = sameLang.find((v) => pattern.test(v.name));
    if (voice) return voice;
  }
  return sameLang[0] ?? voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
}

const EMOJI = new RegExp("\\p{Extended_Pictographic}|\\uFE0F", "gu");
/** Lee textos en voz alta. `speakingId` indica qué mensaje se está leyendo. */
export function useSpeechSynthesis({ lang = "en-US", rate = 1 }: { lang?: string; rate?: number } = {}) {
  const supported = useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Guardar la frase evita que Chrome la descarte antes de terminar (y no avise el final)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const pick = () => {
      voiceRef.current = pickVoice(synth.getVoices(), lang);
    };
    pick();
    synth.addEventListener("voiceschanged", pick);
    return () => {
      synth.removeEventListener("voiceschanged", pick);
      synth.cancel();
    };
  }, [lang]);

  const stop = useCallback(() => {
    utteranceRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (text: string, id: string) => {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(EMOJI, "").replace(/\s+/g, " ").trim());
      utterance.lang = lang;
      utterance.rate = rate;
      if (voiceRef.current) utterance.voice = voiceRef.current;
      const finish = () => {
        // Solo la frase actual puede marcar el final (cancelar dispara eventos de la anterior)
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
          setSpeakingId(null);
        }
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      utteranceRef.current = utterance;
      setSpeakingId(id);
      synth.speak(utterance);
    },
    [lang, rate],
  );

  return { supported, speakingId, speak, stop };
}

// --- Voz para la llamada en vivo ------------------------------------------------

let liveUtterance: SpeechSynthesisUtterance | null = null;

/** iOS solo deja hablar si la primera frase sale de un toque: se "desbloquea" al iniciar la llamada */
export function unlockSpeechSynthesis() {
  if (!("speechSynthesis" in window)) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
}

/** Lee un texto en voz alta; `done` se cumple al terminar (o si se cancela) */
export function speakOnce(text: string, { lang = "en-US", rate = 1 }: { lang?: string; rate?: number } = {}) {
  let finished = false;
  const fallback: { timer?: ReturnType<typeof setTimeout> } = {};
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let utterance: SpeechSynthesisUtterance | null = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallback.timer);
    if (liveUtterance === utterance) liveUtterance = null;
    resolveDone();
  };

  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const clean = text.replace(EMOJI, "").replace(/\s+/g, " ").trim();
  if (!synth || !clean) {
    finish();
    return { done, cancel: finish };
  }

  utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = lang;
  utterance.rate = rate;
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) utterance.voice = voice;
  utterance.onend = finish;
  utterance.onerror = finish;
  liveUtterance = utterance; // que el navegador no la descarte antes de terminar
  synth.cancel();
  synth.speak(utterance);
  // Respaldo: algunos iPhone no avisan cuando termina de hablar
  const words = clean.split(" ").length;
  fallback.timer = setTimeout(finish, ((words * 0.5) / rate + 3) * 1000);

  return {
    done,
    cancel: () => {
      synth.cancel();
      finish();
    },
  };
}

// --- Preferencia de lectura automática (guardada en este navegador) -----------

const AUTO_READ_KEY = "eb:auto-read";
const autoReadListeners = new Set<() => void>();
let autoReadMemory = false;

function readAutoRead() {
  try {
    const value = localStorage.getItem(AUTO_READ_KEY);
    return value === null ? autoReadMemory : value === "1";
  } catch {
    return autoReadMemory;
  }
}

function subscribeAutoRead(listener: () => void) {
  autoReadListeners.add(listener);
  return () => autoReadListeners.delete(listener);
}

export function useAutoRead() {
  const autoRead = useSyncExternalStore(subscribeAutoRead, readAutoRead, () => false);
  const setAutoRead = useCallback((value: boolean) => {
    autoReadMemory = value;
    try {
      localStorage.setItem(AUTO_READ_KEY, value ? "1" : "0");
    } catch {
      // Sin almacenamiento (modo privado): queda solo en memoria
    }
    autoReadListeners.forEach((listener) => listener());
  }, []);
  return [autoRead, setAutoRead] as const;
}
