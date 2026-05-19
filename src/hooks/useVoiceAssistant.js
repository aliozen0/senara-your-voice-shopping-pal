import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "./useSpeech.js";
import { useConversation } from "./useConversation.js";
import {
  getAIService,
  getSearchService,
} from "../services/ServiceFactory.js";
import { MockSearchService } from "../services/search/MockSearchService.js";
import { WardrobeService } from "../services/wardrobe/WardrobeService.js";
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
      if (phase === "comparing" && /\b(al|alıyorum|sipariş|onayla|tamam|satın)\b/.test(lower)) {
        setPhase("ordering");
        // En ucuz ürünün URL'sini aç
        const cheapest = [...priceResults].sort((a, b) => a.price - b.price)[0];
        if (cheapest?.productUrl) {
          window.open(cheapest.productUrl, "_blank");
          say(`En uygun ürünün sayfasını yeni sekmede açtım. Sepete eklemeniz için sizi yönlendirdim. İyi alışverişler!`, false);
        } else if (selectedProduct?.productUrl) {
          window.open(selectedProduct.productUrl, "_blank");
          say(`Ürün sayfasını yeni sekmede açtım. İyi alışverişler!`, false);
        } else {
          say(`Maalesef ürün sayfasını bulamadım. Başka bir şey yapmak ister misiniz?`, true);
        }
        return;
      }

      // Fiyat karşılaştırma isteği
      if (phase === "product_detail" && /(fiyat|karşılaştır|ucuz)/.test(lower)) {
        await runCompare(selectedProduct);
        return;
      }

      // Uygunluk Koçu (Fit Coach)
      if (phase === "product_detail" && /(uyar mı|olur mu|bedenim|yakışır|koçu)/.test(lower)) {
        const profile = getUserProfile();
        say("Hemen ölçülerinizi ve kalıbı kontrol ediyorum...", false);
        const fitAdvice = await ai.checkFit(selectedProduct.name, profile);
        say(fitAdvice + " Başka bir işlem yapmak ister misiniz?", true);
        return;
      }

      // ── DOLAP HAFIZASI ──
      // Dolaba ekle
      if (/(dolabıma ekle|dolaba ekle|gardıroba ekle|kaydet)/.test(lower) && selectedProduct) {
        const added = WardrobeService.add(selectedProduct);
        if (added) {
          say(`${selectedProduct.name.substring(0, 50)} dolabınıza eklendi! Başka bir şey yapmak ister misiniz?`, true);
        } else {
          say("Bu ürün zaten dolabınızda kayıtlı.", true);
        }
        return;
      }

      // Dolabımda ne var?
      if (/(dolabımda ne var|dolabım|gardırobum|dolabı göster|neler var)/.test(lower)) {
        const summary = WardrobeService.buildWardrobeSummary();
        say(summary, true);
        return;
      }

      // Kombin önerisi
      if (/(ne giyebilirim|kombin|kombini|ne yakışır|nasıl kombinlerim)/.test(lower)) {
        const wardrobeContext = WardrobeService.buildWardrobeContext();
        const productName = selectedProduct?.name || "genel kıyafet";
        say("Dolabınızı kontrol edip kombin önerisi hazırlıyorum...", false);
        const suggestion = await ai.suggestOutfit(productName, wardrobeContext);
        say(suggestion, true);
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
        say("Ürünü inceliyorum ve dolabınızla karşılaştırıyorum...", false);
        
        const wardrobeContext = WardrobeService.buildWardrobeContext();
        
        const [imgDesc, reviewSet, wardrobeMatch] = await Promise.all([
          ai.analyzeImage(product.imageUrl),
          ai.analyzeReviews(MockSearchService.getMockReviews?.() ?? []),
          wardrobeContext ? ai.matchWithWardrobe(product.name, wardrobeContext) : Promise.resolve(""),
        ]);
        setImageDescription(imgDesc);
        setReviewAnalysis(reviewSet);
        
        let text = buildProductDetailSummary(product, imgDesc, reviewSet);
        
        // Dolap uyumu varsa ekle
        if (wardrobeMatch) {
          text += ` Dolabınızla uyum analizi: ${wardrobeMatch}`;
        }
        
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
        say("Trendyol'da benzer ürünleri tarıyorum, en uygun fiyatları buluyorum...", false);
        const results = await search.comparePrice(product);
        setPriceResults(results);
        
        if (!results.length || results[0].price === 0) {
          say("Benzer ürün fiyatlarını bulamadım. Başka bir şey yapmak ister misiniz?", true);
          return;
        }
        
        const sorted = [...results].sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        
        let text = `${results.length} benzer ürün buldum. `;
        results.forEach((r, i) => {
          text += `${i + 1}. ${(r.name || "").substring(0, 40)}, ${r.price} TL. `;
        });
        text += `En uygunu ${cheapest.price} TL. Satın almak ister misiniz?`;
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
  if (list.length === 0) return "Hiç ürün bulamadım.";
  
  // Group by categoryName
  const grouped = {};
  list.forEach((p, i) => {
    const cat = p.categoryName || "Önerilenler";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...p, globalIndex: i });
  });

  let text = `Sizin için ${list.length} ürün seçtim. `;
  
  Object.keys(grouped).forEach(cat => {
     text += `${cat}, `;
     grouped[cat].forEach((p, index) => {
         // Determine global 1-based index (e.g. "Üçüncü seçenek:")
         const ordinals = ["Birinci", "İkinci", "Üçüncü", "Dördüncü", "Beşinci", "Altıncı", "Yedinci", "Sekizinci"];
         const globalWord = ordinals[p.globalIndex] || `${p.globalIndex + 1} inci`;
         
         const localWord = index === 0 ? "Birincisi:" : "İkincisi:";
         text += `${localWord} ${p.name.substring(0, 60)}, ${p.price} TL. `;
     });
  });
  
  text += `Detaylarını incelemek istediğiniz ürünün numarasını, örneğin 'birinci' veya 'beşinci' şeklinde söyleyebilirsiniz.`;
  return text;
}

function buildProductDetailSummary(product, imgDesc, review) {
  const reviewCount = product.reviewCount ?? 0;
  
  const positive = review.positive && review.positive.length > 0 ? review.positive[0] : "ürün güzel";
  const negative = review.negative && review.negative.length > 0 ? review.negative[0] : "";
  
  let summary = `${imgDesc} ${reviewCount} değerlendirme var, puanı ${review.score}. `;
  summary += `En çok "${positive}" denmiş. `;
  if (negative) summary += `Fakat bazı kullanıcılar "${negative}" şeklinde şikayette bulunmuş. `;
  
  if (review.sensoryDesc) summary += `${review.sensoryDesc} `;
  if (review.sizeAdvice) summary += `${review.sizeAdvice} `;
  
  summary += `Fiyat karşılaştırması yapalım mı yoksa 'bu bana uyar mı' diyerek beden analizi mi istersiniz?`;
  return summary;
}

function getUserProfile() {
  if (typeof window !== "undefined") {
    const profile = localStorage.getItem("senara_profile");
    if (profile) return JSON.parse(profile);
  }
  // Varsayılan ölçüler (kullanıcı kaydetmemişse)
  return { height: 165, weight: 60, size: "M" };
}

function parseOrdinal(text) {
  // Türkçe konuşma tanıma bazen "ı" ve "i" harflerini karıştırır
  const t = text.toLowerCase().replace(/ı/g, "i").replace(/İ/g, "i");
  if (/birinci|1\.|1\b|bir$|ilk/.test(t)) return 0;
  if (/ikinci|2\.|2\b|iki$/.test(t)) return 1;
  if (/[uü][cç][uü]nc[uü]|3\.|3\b|[uü][cç]$/.test(t)) return 2;
  if (/d[oö]rd[uü]nc[uü]|4\.|4\b|d[oö]rt$/.test(t)) return 3;
  if (/be[sş]inci|5\.|5\b|be[sş]$/.test(t)) return 4;
  if (/altinci|6\.|6\b|alti$/.test(t)) return 5;
  const m = text.match(/\b(\d+)\b/);
  if (m) return Number(m[1]) - 1;
  return null;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
