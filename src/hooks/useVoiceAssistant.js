import { useCallback, useRef, useState } from "react";
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

  const say = useCallback(
    (text, onEnd) => {
      conv.addMessage("assistant", text);
      speech.speak(text, onEnd);
    },
    [conv, speech],
  );

  const handleError = useCallback(
    (msg = STRINGS.errorGeneric) => {
      setError(msg);
      setPhase("error");
      say(msg);
    },
    [say],
  );

  const handleUserInput = useCallback(
    async (text) => {
      if (!text?.trim()) return;
      conv.addMessage("user", text);
      setTranscript(text);

      // Komut yorumlama: bağlama göre seçim/karşılaştırma/sipariş
      const lower = text.toLowerCase();

      // Sipariş onayı
      if (phase === "comparing" && /\b(al|alıyorum|sipariş|onayla|tamam)\b/.test(lower)) {
        setPhase("ordering");
        say(`En uygun mağazaya yönlendiriyorum, sepete ekleniyor...`);
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

      // Aksi halde yeni arama olarak yorumla
      await runSearch(text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, products, selectedProduct],
  );

  const runSearch = useCallback(
    async (text) => {
      try {
        setPhase("processing");
        say(STRINGS.processing);
        const intent = await ai.parseIntent(text);
        const list = await search.searchProducts(intent.query, intent.filters);
        setProducts(list);
        if (!list.length) {
          handleError(STRINGS.noResults);
          return;
        }
        setPhase("results");
        const summary = buildResultsSummary(list);
        say(summary);
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
        say("Ürünü inceliyorum...");
        const [imgDesc, reviewSet] = await Promise.all([
          ai.analyzeImage(product.imageUrl),
          ai.analyzeReviews(MockSearchService.getMockReviews?.() ?? []),
        ]);
        setImageDescription(imgDesc);
        setReviewAnalysis(reviewSet);
        const text = buildProductDetailSummary(product, imgDesc, reviewSet);
        say(text);
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
        say(STRINGS.comparing);
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
          ` En ucuzu ${cheapest.store}, toplam ${cheapest.total} TL. Almak ister misiniz?`;
        say(text);
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
    speech.stopSpeaking();
    setError(null);
    setPhase("listening");
    setTranscript("");
    speech.startListening(
      (text) => {
        if (!text) {
          handleError(STRINGS.errorNoSpeech);
          return;
        }
        handleUserInput(text);
      },
      (err) => {
        console.error(err);
        handleError(STRINGS.errorNoSpeech);
      },
    );
  }, [speech, handleError, handleUserInput]);

  const toggleListening = useCallback(() => {
    if (speech.isListening) {
      speech.stopListening();
      setPhase("idle");
    } else {
      startListening();
    }
  }, [speech, startListening]);

  const reset = useCallback(() => {
    speech.stopSpeaking();
    speech.stopListening();
    setPhase("idle");
    setTranscript("");
    setProducts([]);
    setSelectedProduct(null);
    setReviewAnalysis(null);
    setImageDescription("");
    setPriceResults([]);
    setError(null);
  }, [speech]);

  return {
    phase,
    transcript,
    products,
    selectedProduct,
    reviewAnalysis,
    imageDescription,
    priceResults,
    error,
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
    `Almak ister misiniz? Fiyat karşılaştırması yapalım mı?`
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
