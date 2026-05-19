import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "./useSpeech.js";
import { useConversation } from "./useConversation.js";
import {
  getAIService,
  getSearchService,
} from "../services/ServiceFactory.js";
import { MockSearchService } from "../services/search/MockSearchService.js";
import { STRINGS } from "../config/index.js";

/**
 * Ana orkestrasyon hook'u. Tüm phase geçişlerini yönetir.
 * phases: 'idle' | 'listening' | 'processing' | 'results' |
 *         'product_detail' | 'comparing' | 'ordering' | 'error'
 *
 * ── Erişilebilirlik: Eller-Serbest Mod ──
 * Kullanıcı mikrofona bir kez bastığında "handsFree" modu aktive olur.
 * Asistan konuşmasını DOĞAL olarak bitirdikten sonra otomatik olarak
 * tekrar dinlemeye başlar.
 *
 * ── CANCEL GÜVENLİĞİ ──
 * speechSynthesis.cancel() çağrıldığında Chrome onend event'ini tetikler.
 * Bu, eller-serbest modda auto-listen callback'inin yanlışlıkla
 * çalışmasına neden olur. suppressAutoListenRef bu durumu engeller:
 * - Manuel iptal (mikrofona basma) → suppress=true → callback çalışmaz
 * - Doğal bitiş (asistan konuşmasını tamamlar) → suppress=false → callback çalışır
 */
export function useVoiceAssistant() {
  const ai = useRef(getAIService()).current;
  const search = useRef(getSearchService()).current;
  const speech = useSpeech();
  const conv = useConversation();

  const [phase, setPhase] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reviewAnalysis, setReviewAnalysis] = useState(null);
  const [imageDescription, setImageDescription] = useState("");
  const [priceResults, setPriceResults] = useState([]);
  const [error, setError] = useState(null);
  const [handsFree, setHandsFree] = useState(false);

  const startListeningRef = useRef(null);

  // ── CANCEL GÜVENLİĞİ ──
  // true iken, konuşma bitişinde auto-listen tetiklenmez.
  // Manuel iptal sırasında true yapılır, doğal bitişte false kalır.
  const suppressAutoListenRef = useRef(false);

  /**
   * TÜM konuşmaları anında durdurur.
   * Çağrılmadan önce suppressAutoListenRef.current = true yapılmalıdır,
   * aksi halde onend callback'i auto-listen'ı tetikler.
   */
  const forceStopAllSpeech = useCallback(() => {
    speech.stopSpeaking();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
  }, [speech]);

  /**
   * Asistanın sesli konuşmasını başlatır.
   * autoListen=true ise konuşma DOĞAL olarak bittikten sonra dinlemeye geçer.
   */
  const say = useCallback(
    (text, autoListen = true) => {
      conv.addMessage("assistant", text);
      speech.speak(text, () => {
        // ── Konuşma bitti ──
        // Manuel iptal mi yoksa doğal bitiş mi kontrol et
        if (suppressAutoListenRef.current) {
          // Manuel iptal: callback'i yut, flag'i sıfırla
          suppressAutoListenRef.current = false;
          return;
        }
        // Doğal bitiş: eller-serbest modda dinlemeye geç
        if (autoListen && handsFree && startListeningRef.current) {
          setTimeout(() => {
            startListeningRef.current?.();
          }, 500);
        }
      });
    },
    [conv, speech, handsFree],
  );

  const handleError = useCallback(
    (msg = STRINGS.errorGeneric) => {
      setError(msg);
      setPhase("error");
      // ── HATA SONRASI AUTO-LISTEN KAPALI ──
      // autoListen=false: hata mesajı bittikten sonra tekrar dinlemeye
      // başlamaz. Aksi halde hata → dinle → hata → dinle sonsuz döngüsü oluşur.
      // Kullanıcının mikrofona tekrar basması gerekir.
      say(msg, false);
    },
    [say],
  );

  const handleUserInput = useCallback(
    async (text) => {
      if (!text?.trim()) return;
      conv.addMessage("user", text);
      setTranscript(text);

      const lower = text.toLowerCase();

      // Sipariş onayı
      if (phase === "comparing" && /\b(al|alıyorum|sipariş|onayla|tamam)\b/.test(lower)) {
        setPhase("ordering");
        say(`En uygun mağazaya yönlendiriyorum, sepete ekleniyor...`, false);
        return;
      }

      // Fiyat karşılaştırma isteği
      if (phase === "product_detail" && /(fiyat|karşılaştır|ucuz)/.test(lower)) {
        await runCompare(selectedProduct);
        return;
      }

      // Sonuç listesinden seçim
      if (phase === "results") {
        const idx = parseOrdinal(lower);
        if (idx != null && products[idx]) {
          await selectProduct(products[idx]);
          return;
        }
      }

      // Aksi halde yeni arama
      await runSearch(text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, products, selectedProduct],
  );

  const runSearch = useCallback(
    async (text) => {
      try {
        setPhase("processing");
        say(STRINGS.processing, false);
        const intent = await ai.parseIntent(text);
        const list = await search.searchProducts(intent.query, intent.filters);
        setProducts(list);
        if (!list.length) {
          handleError(STRINGS.noResults);
          return;
        }
        setPhase("results");
        const summary = buildResultsSummary(list);
        say(summary, true);
      } catch (e) {
        console.error(e);
        handleError();
      }
    },
    [ai, search, say, handleError],
  );

  const selectProduct = useCallback(
    async (product) => {
      try {
        setSelectedProduct(product);
        setPhase("product_detail");
        say("Ürünü inceliyorum...", false);
        const [imgDesc, reviewSet] = await Promise.all([
          ai.analyzeImage(product.imageUrl),
          ai.analyzeReviews(MockSearchService.getMockReviews?.() ?? []),
        ]);
        setImageDescription(imgDesc);
        setReviewAnalysis(reviewSet);
        const text = buildProductDetailSummary(product, imgDesc, reviewSet);
        say(text, true);
      } catch (e) {
        console.error(e);
        handleError();
      }
    },
    [ai, say, handleError],
  );

  const runCompare = useCallback(
    async (product) => {
      if (!product) return;
      try {
        setPhase("comparing");
        say(STRINGS.comparing, false);
        const results = await search.comparePrice(product.name);
        setPriceResults(results);
        const cheapest = results
          .map((r) => ({ ...r, total: r.price + r.shipping }))
          .sort((a, b) => a.total - b.total)[0];
        const text =
          results
            .map(
              (r) =>
                `${r.store} ${r.price} TL, kargo ${r.shipping === 0 ? "ücretsiz" : r.shipping + " TL"}.`,
            )
            .join(" ") +
          ` En ucuzu ${cheapest.store}, toplam ${cheapest.total} TL. Almak ister misiniz? Al veya hayır deyin.`;
        say(text, true);
      } catch (e) {
        console.error(e);
        handleError();
      }
    },
    [search, say, handleError],
  );

  const startListening = useCallback(() => {
    if (!speech.isSupported) {
      handleError(STRINGS.errorBrowserUnsupported);
      return;
    }

    // ── ÖNCE: Manuel iptal flag'ini kaldır ──
    // Bu çağrı ya kullanıcıdan (toggleListening) ya da auto-listen'dan gelir.
    // Eğer kullanıcıdan geldiyse suppress zaten true yapılmış olacak (toggleListening'de).
    // Eğer auto-listen'dan geldiyse suppress false olacak (say callback'inden).
    // Her iki durumda da konuşmayı durdurmamız lazım:
    suppressAutoListenRef.current = true; // cancel'dan gelecek onend'i bastır
    forceStopAllSpeech();

    setError(null);
    setPhase("listening");
    setTranscript("");

    if (!handsFree) setHandsFree(true);

    speech.startListening(
      (text) => {
        if (!text) {
          // Boş sonuç — sessizce hata göster, auto-listen yok
          setError(STRINGS.errorNoSpeech);
          setPhase("error");
          say(STRINGS.errorNoSpeech, false);
          return;
        }
        // Başarılı girdi — hata sayacını sıfırla
        setError(null);
        handleUserInput(text);
      },
      (err) => {
        console.error("[Senara] Speech recognition error:", err);
        // Hata — sessizce göster, döngü oluşturmadan
        setError(STRINGS.errorNoSpeech);
        setPhase("error");
        say(STRINGS.errorNoSpeech, false);
      },
    );
  }, [speech, handleError, handleUserInput, handsFree, forceStopAllSpeech]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const toggleListening = useCallback(() => {
    if (speech.isListening) {
      speech.stopListening();
      setPhase("idle");
      setHandsFree(false);
    } else {
      startListening();
    }
  }, [speech, startListening]);

  const reset = useCallback(() => {
    suppressAutoListenRef.current = true;
    forceStopAllSpeech();
    speech.stopListening();
    setPhase("idle");
    setTranscript("");
    setProducts([]);
    setSelectedProduct(null);
    setReviewAnalysis(null);
    setImageDescription("");
    setPriceResults([]);
    setError(null);
    setHandsFree(false);
  }, [speech, forceStopAllSpeech]);

  return {
    phase,
    transcript,
    products,
    selectedProduct,
    reviewAnalysis,
    imageDescription,
    priceResults,
    error,
    handsFree,
    messages: conv.messages,
    isListening: speech.isListening,
    isSpeaking: speech.isSpeaking,
    isSupported: speech.isSupported,
    startListening,
    toggleListening,
    stopSpeaking: speech.stopSpeaking,
    handleUserInput,
    selectProduct,
    runCompare,
    reset,
    clearHistory: conv.clearHistory,
  };
}

function buildResultsSummary(list) {
  const top = list.slice(0, 3);
  const parts = top.map((p, i) => {
    const ord = ["Birincisi", "İkincisi", "Üçüncüsü"][i];
    return `${ord}: ${p.name}, ${capitalize(p.store)}, ${p.price} TL, ${p.rating} yıldız.`;
  });
  return `${list.length} ürün buldum. ${parts.join(" ")} Detay için birinci, ikinci veya üçüncü deyin.`;
}

function buildProductDetailSummary(product, imgDesc, review) {
  const reviewCount = product.reviewCount ?? 0;
  return (
    `${imgDesc} ${reviewCount} yorum var. ` +
    `Olumlu: ${review.positive.join(", ")}. ` +
    `Olumsuz: ${review.negative.join(", ")}. ` +
    `Kumaş hissi: ${review.sensoryDesc} ${review.sizeAdvice} ` +
    `Öneri skorum 10 üzerinden ${review.score}. ` +
    `Fiyat karşılaştırması yapalım mı? Fiyat karşılaştır veya al deyin.`
  );
}

function parseOrdinal(text) {
  if (/birinci|1\.|bir$|ilk/.test(text)) return 0;
  if (/ikinci|2\.|iki$/.test(text)) return 1;
  if (/üçüncü|3\.|üç$/.test(text)) return 2;
  if (/dördüncü|4\.|dört$/.test(text)) return 3;
  const m = text.match(/\b(\d+)\b/);
  if (m) return Number(m[1]) - 1;
  return null;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
