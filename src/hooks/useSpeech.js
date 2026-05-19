import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechService } from "../services/ServiceFactory.js";

export function useSpeech() {
  const serviceRef = useRef(null);
  if (!serviceRef.current) serviceRef.current = getSpeechService();

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const startListening = useCallback((onResult, onError) => {
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
    isSupported: serviceRef.current.isSupported(),
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
