import { SpeechServiceInterface } from "./SpeechServiceInterface.js";
import { SPEECH_LANG } from "../../config/index.js";

/**
 * Web Speech API implementasyonu (Türkçe).
 * @implements {SpeechServiceInterface}
 */
export class WebSpeechService extends SpeechServiceInterface {
  constructor() {
    super();
    this._recognition = null;
    this._listening = false;
    this._speaking = false;
    this._currentUtterance = null;
  }

  isSupported() {
    if (typeof window === "undefined") return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return Boolean(SR) && "speechSynthesis" in window;
  }

  startListening(onResult, onError) {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      onError?.(new Error("SpeechRecognition desteklenmiyor"));
      return;
    }
    this.stopListening();
    const recognition = new SR();
    recognition.lang = SPEECH_LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      this._listening = false;
      onResult?.(transcript);
    };
    recognition.onerror = (event) => {
      this._listening = false;
      onError?.(new Error(event.error || "speech-error"));
    };
    recognition.onend = () => {
      this._listening = false;
    };

    this._recognition = recognition;
    this._listening = true;
    try {
      recognition.start();
    } catch (e) {
      this._listening = false;
      onError?.(e);
    }
  }

  stopListening() {
    try { this._recognition?.stop(); } catch { /* noop */ }
    this._listening = false;
  }

  speak(text, onEnd) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }
    this.stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LANG;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onend = () => {
      this._speaking = false;
      onEnd?.();
    };
    utter.onerror = () => {
      this._speaking = false;
      onEnd?.();
    };
    this._currentUtterance = utter;
    this._speaking = true;
    window.speechSynthesis.speak(utter);
  }

  stopSpeaking() {
    if (typeof window === "undefined") return;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    this._speaking = false;
  }

  isListening() { return this._listening; }
  isSpeaking() { return this._speaking; }
}
