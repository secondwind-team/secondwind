"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FinzChatMessage } from "@/lib/common/services/finz-chat";
import { canListenToFinzMessage, prepareFinzSpeechText } from "@/lib/common/services/finz-message-listen";

export type FinzSpeechStatus = "idle" | "speaking" | "paused";

export function useFinzMessageSpeech(onError?: (message: string) => void) {
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<FinzSpeechStatus>("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    activeMessageIdRef.current = null;
    setActiveMessageId(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      setSupported(false);
      return;
    }
    setSupported(true);
    const synth = window.speechSynthesis;
    const syncVoices = () => setVoices(synth.getVoices());
    syncVoices();
    synth.addEventListener?.("voiceschanged", syncVoices);
    return () => {
      synth.removeEventListener?.("voiceschanged", syncVoices);
      synth.cancel();
    };
  }, []);

  const koreanVoice = useMemo(
    () => voices.find((voice) => voice.lang.toLowerCase() === "ko-kr") ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")),
    [voices],
  );

  const speak = useCallback((message: FinzChatMessage) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      onError?.("이 브라우저에서는 음성 읽기를 지원하지 않습니다.");
      return;
    }
    if (!canListenToFinzMessage(message) || message.kind !== "text") return;
    const text = prepareFinzSpeechText(message.text);
    if (!text) {
      onError?.("읽을 수 있는 텍스트가 없어요.");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1;
    utterance.pitch = 1;
    if (koreanVoice) utterance.voice = koreanVoice;

    activeMessageIdRef.current = message.id;
    utteranceRef.current = utterance;
    setActiveMessageId(message.id);
    setStatus("speaking");

    utterance.onend = () => {
      if (activeMessageIdRef.current !== message.id) return;
      utteranceRef.current = null;
      activeMessageIdRef.current = null;
      setActiveMessageId(null);
      setStatus("idle");
    };
    utterance.onerror = () => {
      if (activeMessageIdRef.current !== message.id) return;
      utteranceRef.current = null;
      activeMessageIdRef.current = null;
      setActiveMessageId(null);
      setStatus("idle");
      onError?.("음성 읽기를 시작하지 못했어요.");
    };

    try {
      synth.speak(utterance);
    } catch {
      stop();
      onError?.("음성 읽기를 시작하지 못했어요.");
    }
  }, [koreanVoice, onError, stop]);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, []);

  const toggle = useCallback((message: FinzChatMessage) => {
    if (activeMessageIdRef.current !== message.id || status === "idle") {
      speak(message);
      return;
    }
    if (status === "speaking") pause();
    else resume();
  }, [pause, resume, speak, status]);

  return { supported, activeMessageId, status, speak, toggle, stop };
}
