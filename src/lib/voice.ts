/** Browser speech-to-text (Web Speech API). Works in Safari on iOS and in Chrome. */
import { useEffect, useRef, useState } from 'react';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type Ctor = new () => Recognition;
const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;

export const voiceSupported = !!Impl;

/** Appends finalized speech to the text via `onText`. */
export function useDictation(onText: (chunk: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const start = () => {
    if (!Impl || listening) return;
    const r = new Impl();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
    navigator.vibrate?.(8);
  };
  const stop = () => rec.current?.stop();
  return { listening, start, stop, toggle: () => (listening ? stop() : start()) };
}
