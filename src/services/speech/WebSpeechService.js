import { SpeechServiceInterface } from "./SpeechServiceInterface.js";
import { SPEECH_LANG } from "../../config/index.js";

/**
 * Web Speech API implementasyonu (Türkçe).
 *
 * ── Çalışma Modları ──
 * 1. NORMAL MOD (localhost/web): Doğrudan SpeechRecognition + SpeechSynthesis
 * 2. EXTENSION MOD (chrome-extension://):
 *    - SpeechRecognition → background.js'e mesaj → aktif tab'a inject
 *    - SpeechSynthesis → side panel'de doğrudan çalışır (izin gerekmiyor)
 *
 * @implements {SpeechServiceInterface}
 */
export class WebSpeechService extends SpeechServiceInterface {
  constructor() {
    super();
    this._recognition = null;
    this._listening = false;
    this._speaking = false;
    this._currentUtterance = null;

    // Extension ortamında mıyız?
    this._isExtension = typeof chrome !== "undefined" &&
                        !!chrome.runtime?.sendMessage &&
                        typeof window !== "undefined" &&
                        window.location?.protocol === "chrome-extension:";

    if (this._isExtension) {
      console.log("[Senara] Extension modu — tab-inject speech ✓");
    }
  }

  isSupported() {
    if (typeof window === "undefined") return false;

    // Extension modunda tab inject destekli kabul et
    if (this._isExtension) return true;

    // Normal modda doğrudan kontrol
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return Boolean(SR) && "speechSynthesis" in window;
  }

  // ── LISTENING ──

  startListening(onResult, onError) {
    if (this._isExtension) {
      this._startListeningExtension(onResult, onError);
    } else {
      this._startListeningDirect(onResult, onError);
    }
  }

  /**
   * Extension modu: background.js'e mesaj gönder → aktif tab'a inject eder
   */
  _startListeningExtension(onResult, onError) {
    this._listening = true;

    chrome.runtime.sendMessage({ type: "START_LISTENING" }, (response) => {
      this._listening = false;

      if (chrome.runtime.lastError) {
        console.error("[Senara] Background hatası:", chrome.runtime.lastError);
        onError?.(new Error("background-error"));
        return;
      }

      if (response?.error) {
        console.error("[Senara] Recognition hatası:", response.error);
        onError?.(new Error(response.error));
        return;
      }

      if (response?.transcript) {
        console.log("[Senara] Tanıma sonucu:", response.transcript);
        onResult?.(response.transcript);
      } else {
        onError?.(new Error("no-speech"));
      }
    });
  }

  /**
   * Normal mod: doğrudan SpeechRecognition kullan
   */
  _startListeningDirect(onResult, onError) {
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
    if (this._isExtension) {
      chrome.runtime.sendMessage({ type: "STOP_LISTENING" }).catch(() => {});
    } else {
      try { this._recognition?.stop(); } catch { /* noop */ }
    }
    this._listening = false;
  }

  // ── SPEAKING (Side panel'de doğrudan çalışır — izin gerekmez) ──

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
