"use client";

/*
 * Captura del micrófono con Web Audio (sin MediaRecorder).
 * - Convierte la voz a WAV 16 kHz mono: Whisper lo acepta siempre (el mp4 que graba
 *   el iPhone con MediaRecorder lo rechazaba: "could not process file").
 * - Mide el volumen de cada fragmento para detectar cuándo la usuaria habla (modo en vivo).
 * - El micrófono se abre UNA vez y se comparte (permiso una sola vez por sesión).
 */

const TARGET_RATE = 16_000;
const FRAME_SIZE = 2048;

export type FrameListener = (frame: Float32Array, rms: number) => void;

type AudioContextCtor = typeof AudioContext;

class MicCapture {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private listeners = new Set<FrameListener>();
  sampleRate = 48_000;

  get isOpen() {
    return Boolean(this.stream?.getAudioTracks().some((t) => t.readyState === "live") && this.ctx && this.ctx.state !== "closed");
  }

  /** Duración en ms de cada fragmento que recibe un listener */
  get frameMs() {
    return (FRAME_SIZE / this.sampleRate) * 1000;
  }

  /** Abre el micrófono. Debe llamarse desde un toque de la usuaria (iOS lo exige). */
  async open() {
    if (this.isOpen) {
      await this.ensureRunning();
      return;
    }
    this.close();
    const Ctor: AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
    // Se crea y se reanuda dentro del toque, antes de cualquier await
    const ctx = new Ctor();
    this.ctx = ctx;
    const resumed = ctx.resume().catch(() => {});
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      this.close();
      throw error;
    }
    await resumed;
    this.sampleRate = ctx.sampleRate;
    this.source = ctx.createMediaStreamSource(this.stream);
    this.sink = ctx.createGain();
    this.sink.gain.value = 0; // no se escucha nada por el parlante

    const emit = (frame: Float32Array) => {
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      this.listeners.forEach((listener) => listener(frame, rms));
    };
    try {
      // AudioWorklet: corre en el hilo de audio, no pierde fragmentos si la página está ocupada
      await ctx.audioWorklet.addModule("/audio/capture-processor.js");
      const node = new AudioWorkletNode(ctx, "capture-processor");
      node.port.onmessage = (event: MessageEvent<Float32Array>) => emit(event.data);
      this.processor = node;
    } catch {
      // Respaldo para navegadores sin AudioWorklet
      const node = ctx.createScriptProcessor(FRAME_SIZE, 1, 1);
      node.onaudioprocess = (event) => emit(new Float32Array(event.inputBuffer.getChannelData(0)));
      this.processor = node;
    }
    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    this.sink.connect(ctx.destination);
  }

  /** iOS puede pausar el audio cuando el teléfono habla; esto lo reanuda */
  async ensureRunning() {
    if (!this.ctx || this.ctx.state === "running") return this.ctx?.state === "running";
    await this.ctx.resume().catch(() => {});
    return (this.ctx.state as AudioContextState) === "running";
  }

  subscribe(listener: FrameListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close() {
    if (this.processor instanceof AudioWorkletNode) this.processor.port.onmessage = null;
    else if (this.processor) this.processor.onaudioprocess = null;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.source = null;
    this.processor = null;
    this.sink = null;
  }
}

/** Micrófono compartido por el chat (dictado y llamada en vivo) */
export const micCapture = new MicCapture();

/** Une los fragmentos y los convierte en WAV 16 kHz mono (PCM 16 bits) */
export function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = inputRate / TARGET_RATE;
  const outLength = Math.floor(length / ratio);
  const pcm = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    // Promedio de las muestras de cada intervalo (evita ruido al bajar la frecuencia)
    const start = Math.floor(i * ratio);
    const end = Math.min(length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true); // tamaño del bloque fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // bytes por muestra
  view.setUint16(34, 16, true); // bits por muestra
  write(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  return new Blob([buffer], { type: "audio/wav" });
}

export class TranscribeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Envía el WAV a /api/transcribe (Whisper en el servidor) y devuelve el texto */
export async function transcribeWav(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", wav, "audio.wav");
  let res: Response;
  try {
    res = await fetch("/api/transcribe", { method: "POST", body: form });
  } catch {
    throw new TranscribeError("No hay conexión. Revisa tu internet.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.text !== "string") {
    throw new TranscribeError(data.error ?? "No pude entender el audio.", res.status);
  }
  return data.text;
}

export function micErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permite el uso del micrófono para hablar con Emma (en iPhone: Ajustes → Apps → Safari → Micrófono).";
  }
  if (name === "NotFoundError") return "No encontré un micrófono en este dispositivo.";
  return "No pude usar el micrófono. Inténtalo de nuevo.";
}
