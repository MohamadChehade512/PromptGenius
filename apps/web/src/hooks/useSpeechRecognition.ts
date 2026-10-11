import { useCallback, useEffect, useRef, useState } from 'react';

/** The parts of the browser's SpeechRecognition API this app uses (not in TypeScript's DOM types). */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type SpeechError = 'denied' | 'no-microphone' | 'network' | 'failed';

const ERRORS: Record<string, SpeechError> = {
  'not-allowed': 'denied',
  'service-not-allowed': 'denied',
  'audio-capture': 'no-microphone',
  network: 'network',
};

/**
 * Dictation with the browser's built-in speech recognition (Chrome, Edge, Safari).
 * `onFinal` gets each finished phrase; `interim` is the phrase still being spoken.
 * The browser stops listening after a pause, so while the mic is on it's restarted.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = !!recognitionCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || wanted.current) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!;
        const text = result[0].transcript;
        if (result.isFinal) onFinalRef.current(text.trim());
        else pending += text;
      }
      setInterim(pending.trim());
    };
    r.onerror = (e) => {
      // Silence isn't an error: keep listening.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wanted.current = false;
      setError(ERRORS[e.error] ?? 'failed');
    };
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          wanted.current = false;
        }
      }
      setListening(false);
      setInterim('');
    };
    recognition.current = r;
    wanted.current = true;
    setError(null);
    try {
      r.start();
      setListening(true);
    } catch {
      wanted.current = false;
      setError('failed');
    }
  }, []);

  // Release the microphone when the page is left.
  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
