import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio } from '../api/chat.api';

export type VoiceState = 'idle' | 'recording' | 'transcribing';

const SILENCE_TIMEOUT_MS = 5000;
const MAX_RECORDING_MS = 60000;
const SILENCE_THRESHOLD = 0.01;
const SILENCE_CHECK_INTERVAL_MS = 200;

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
    silenceCheckRef.current = null;
    animFrameRef.current = null;
    stoppingRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const stopAndTranscribe = useCallback(async () => {
    // Guard against concurrent calls from silence/max/user triggers
    if (stoppingRef.current) return '';
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return '';
    stoppingRef.current = true;

    // Clear timers immediately to prevent re-entry
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
    maxTimerRef.current = null;
    silenceCheckRef.current = null;

    const mimeType = mimeTypeRef.current;

    return new Promise<string>((resolve) => {
      recorder.onstop = async () => {
        cleanup();

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setState('idle');
          resolve('');
          return;
        }

        setState('transcribing');
        try {
          const text = await transcribeAudio(blob);
          setState('idle');
          resolve(text);
        } catch {
          setError('Erreur de transcription. Réessayez.');
          setState('idle');
          resolve('');
        }
      };

      recorder.stop();
    });
  }, [cleanup]);

  const startRecording = useCallback(async (): Promise<void> => {
    // Guard against double-tap
    if (state !== 'idle') return;

    setError(null);
    chunksRef.current = [];
    setElapsed(0);
    setAnalyserData([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analyser for waveform visualization
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Choose codec — prefer webm/opus, fall back to mp4 (iOS Safari)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(500); // collect chunks every 500ms
      setState('recording');

      // Elapsed timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Max duration
      maxTimerRef.current = setTimeout(() => {
        stopAndTranscribe();
      }, MAX_RECORDING_MS);

      // Silence detection
      let lastSoundAt = Date.now();
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      silenceCheckRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length / 255;

        if (avg > SILENCE_THRESHOLD) {
          lastSoundAt = Date.now();
        } else if (Date.now() - lastSoundAt > SILENCE_TIMEOUT_MS) {
          stopAndTranscribe();
        }
      }, SILENCE_CHECK_INTERVAL_MS);

      // Waveform animation loop
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const normalized = Array.from(data).map((v) => v / 255);
        setAnalyserData(normalized);
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      animFrameRef.current = requestAnimationFrame(updateWaveform);
    } catch {
      setError('Accès au micro refusé. Vérifiez les permissions.');
      setState('idle');
      cleanup();
    }
  }, [state, cleanup, stopAndTranscribe]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    chunksRef.current = [];
    setState('idle');
    setElapsed(0);
    setAnalyserData([]);
  }, [cleanup]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    state,
    elapsed,
    formattedTime: formatTime(elapsed),
    error,
    analyserData,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
  };
}
