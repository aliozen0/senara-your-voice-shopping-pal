import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechService } from "../services/ServiceFactory.js";

export function useSpeech() {
  const serviceRef = useRef(null);
  if (!serviceRef.current) serviceRef.current = getSpeechService();

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // SSR'da window yoktur; isSupported'ı client mount'tan sonra değerlendir.
  // Sunucu tarafında true varsayarak hydration mismatch'i (butonun disabled
  // kalması ve kırmızı yasak imleci) önlüyoruz.
  const [isSupported, setIsSupported] = useState(true);
  useEffect(() => {
    setIsSupported(serviceRef.current.isSupported());
  }, []);

  const startListening = useCallback((onResult, onError, onEnd) => {
    setIsListening(true);
    serviceRef.current.startListening(
      (text) => {
        setIsListening(false);
        onResult?.(text);
      },
      (err) => {
        setIsListening(false);
        onError?.(err);
      },
      () => {
        setIsListening(false);
        onEnd?.();
      }
    );
  }, []);

  const stopListening = useCallback(() => {
    serviceRef.current.stopListening();
    setIsListening(false);
  }, []);

  const speak = useCallback((text, onEnd) => {
    setIsSpeaking(true);
    serviceRef.current.speak(text, () => {
      setIsSpeaking(false);
      onEnd?.();
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    serviceRef.current.stopSpeaking();
    setIsSpeaking(false);
  }, []);

  useEffect(() => () => {
    serviceRef.current?.stopListening();
    serviceRef.current?.stopSpeaking();
  }, []);

  return {
    isListening,
    isSpeaking,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
