// Tüm uygulama konfigürasyonu buradan okunur.
// Kod içinde hardcoded değer kullanmayın.

export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.VITE_IO_API_KEY ?? "";
export const IO_API_KEY = GEMINI_API_KEY; // Geriye dönük uyumluluk
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") === "true";

export const SUPPORTED_SITES = ["trendyol", "hepsiburada", "n11", "amazon"];

export const SPEECH_LANG = "tr-TR";

export const TIMEOUTS = {
  listeningMs: 10000,
  responseMs: 60000,
};

export const STORAGE_KEYS = {
  conversation: "senara.conversation.v1",
};

export const STRINGS = {
  appName: "Senara",
  tagline: "Sesli Alışveriş Asistanı",
  greeting: "Merhaba! Ne aramak istersiniz?",
  listening: "Dinliyorum...",
  processing: "Arama yapıyorum...",
  comparing: "Fiyatları karşılaştırıyorum...",
  ordering: "Siparişiniz hazırlanıyor...",
  micLabel: "Mikrofonu başlat veya durdur",
  stopSpeakingLabel: "Sesli okumayı durdur",
  errorGeneric: "Bir hata oluştu, tekrar dener misiniz?",
  errorNoSpeech: "Sizi duyamadım, tekrar deneyin lütfen.",
  errorBrowserUnsupported:
    "Tarayıcınız sesli komutları desteklemiyor. Lütfen Chrome kullanın.",
  noResults: "Üzgünüm, sonuç bulamadım.",
  tapToStart: "Konuşmak için mikrofona dokunun",
};
