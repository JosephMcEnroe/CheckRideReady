"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type VoiceInputProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

const MAX_RECORDING_SECONDS = 60;

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear error after 4 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }

  async function sendForTranscription(blob: Blob) {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    try {
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.text) {
        onTranscript(data.text);
      } else {
        setError(data.error || "Could not transcribe audio. Please try again.");
      }
    } catch {
      setError("Could not transcribe audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stream.getTracks().forEach((t) => t.stop());
      await sendForTranscription(blob);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setSeconds(0);

    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    autoStopRef.current = setTimeout(() => {
      stopRecording();
    }, MAX_RECORDING_SECONDS * 1000);
  }

  function stopRecording() {
    clearTimers();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsProcessing(true);
  }

  function handleClick() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {isProcessing ? (
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground opacity-60"
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />
          Transcribing...
        </button>
      ) : isRecording ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-100"
        >
          <Square className="h-4 w-4 fill-current" />
          Stop Recording ({seconds}s)
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Mic className="h-4 w-4" />
          Voice Input
        </button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
