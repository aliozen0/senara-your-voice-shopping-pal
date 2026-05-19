/**
 * @fileoverview Senara Offscreen — SpeechRecognition & SpeechSynthesis Handler
 *
 * Chrome Extension side panel'inde mikrofon erişimi kısıtlıdır.
 * Bu offscreen document mikrofon ve TTS erişimini sağlar.
 *
 * İletişim: side panel ↔ background ↔ offscreen (chrome.runtime messages)
 *
 * Desteklenen mesaj tipleri:
 *   OFFSCREEN_START_LISTENING  → SpeechRecognition başlat
 *   OFFSCREEN_STOP_LISTENING   → SpeechRecognition durdur
 *   OFFSCREEN_SPEAK            → SpeechSynthesis ile konuş
 *   OFFSCREEN_STOP_SPEAKING    → SpeechSynthesis iptal
 */

let recognition = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "OFFSCREEN_START_LISTENING":
      startListening();
      sendResponse({ ok: true });
      break;

    case "OFFSCREEN_STOP_LISTENING":
      stopListening();
      sendResponse({ ok: true });
      break;

    case "OFFSCREEN_SPEAK":
      speak(message.text);
      sendResponse({ ok: true });
      break;

    case "OFFSCREEN_STOP_SPEAKING":
      stopSpeaking();
      sendResponse({ ok: true });
      break;

    default:
      return false;
  }
  return false; // Senkron response
});

/**
 * SpeechRecognition başlat — mikrofon dinle
 */
function startListening() {
  stopListening(); // Öncekini temizle

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_RECOGNITION_ERROR",
      error: "SpeechRecognition desteklenmiyor",
    });
    return;
  }

  recognition = new SR();
  recognition.lang = "tr-TR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    console.log("[Senara Offscreen] Tanıma sonucu:", transcript);
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_RECOGNITION_RESULT",
      transcript: transcript,
    });
  };

  recognition.onerror = (event) => {
    console.error("[Senara Offscreen] SpeechRecognition hatası:", event.error);
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_RECOGNITION_ERROR",
      error: event.error || "speech-error",
    });
  };

  recognition.onend = () => {
    console.log("[Senara Offscreen] SpeechRecognition sona erdi");
  };

  try {
    recognition.start();
    console.log("[Senara Offscreen] SpeechRecognition başlatıldı ✓");
  } catch (e) {
    console.error("[Senara Offscreen] SpeechRecognition başlatılamadı:", e);
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_RECOGNITION_ERROR",
      error: e.message,
    });
  }
}

/**
 * SpeechRecognition durdur
 */
function stopListening() {
  try {
    recognition?.stop();
  } catch {
    /* noop */
  }
  recognition = null;
}

/**
 * SpeechSynthesis ile konuş
 */
function speak(text) {
  if (!text) return;
  stopSpeaking();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "tr-TR";
  utter.rate = 1.0;
  utter.pitch = 1.0;

  utter.onend = () => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_SPEAK_END" });
  };
  utter.onerror = () => {
    chrome.runtime.sendMessage({ type: "OFFSCREEN_SPEAK_END" });
  };

  window.speechSynthesis.speak(utter);
  console.log("[Senara Offscreen] Konuşma başladı:", text.substring(0, 50) + "...");
}

/**
 * SpeechSynthesis iptal
 */
function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* noop */
  }
}
