import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "./useSpeech.js";
import { useConversation } from "./useConversation.js";
import {
  getAIService,
  getSearchService,
} from "../services/ServiceFactory.js";
import { WardrobeService } from "../services/wardrobe/WardrobeService.js";
import { CartService } from "../services/cart/CartService.js";
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
  const handsFreeRef = useRef(false);
  const setHandsFreeSync = (val) => {
    handsFreeRef.current = val;
    setHandsFree(val);
  };

  // Ref sync helpers
  const setProductsSync = (list) => { productsRef.current = list; setProducts(list); };
  const setSelectedProductSync = (p) => { selectedProductRef.current = p; setSelectedProduct(p); };
  const setPhaseSync = (ph) => { phaseRef.current = ph; setPhase(ph); };
  const setPriceResultsSync = (r) => { priceResultsRef.current = r; setPriceResults(r); };

  const startListeningRef = useRef(null);
  // Ref'ler her zaman güncel değerleri tutar (stale closure sorununu çözer)
  const productsRef = useRef([]);
  const selectedProductRef = useRef(null);
  const phaseRef = useRef("idle");
  const priceResultsRef = useRef([]);
  // Fonksiyon ref'leri — tanım sırası fark etmeksizin her zaman güncel versiyonu çağırır
  const selectProductRef = useRef(null);
  const runSearchRef = useRef(null);
  const lastSpeakFinishedRef = useRef(0);
  const currentlySpeakingTextRef = useRef("");

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
      currentlySpeakingTextRef.current = text;
      
      speech.speak(text, () => {
        // ── Konuşma bitti ──
        lastSpeakFinishedRef.current = Date.now();
        currentlySpeakingTextRef.current = "";
        if (suppressAutoListenRef.current) {
          suppressAutoListenRef.current = false;
          return;
        }
        // Doğal bitiş: eğer handsFree aktifse dinlemeyi başlat (1200ms güvenlik payı)
        if (autoListen && handsFreeRef.current && startListeningRef.current && !speech.isListening) {
          setTimeout(() => {
            startListeningRef.current?.(false);
          }, 1200);
        }
      });

      // Konuşurken de dinlemesi için hemen mikrofona başla (handsFree ise)
      if (autoListen && handsFreeRef.current && startListeningRef.current) {
        setTimeout(() => {
          // keepSpeechRunning=true olarak başlat ki konuşmayı yarıda kesmesin.
          // Kullanıcı konuşmaya başlayınca (onsoundstart) konuşma otomatik olarak kesilecek.
          startListeningRef.current?.(true);
        }, 200);
      }
    },
    [conv, speech],
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

      // ── KENDİ SESİNİ ALGILEMA VE LAF BÖLME (SELF-VOICE & BARGE-IN FILTER) ──
      const timeSinceFinished = Date.now() - lastSpeakFinishedRef.current;
      const lowerText = text.toLowerCase().trim();
      const assistantText = currentlySpeakingTextRef.current?.toLowerCase() ?? "";

      const selfVoice = isSelfVoice(lowerText, assistantText);

      // Eğer asistan konuşurken kendi sesini duyduysa yoksay
      if (speech.isSpeaking && selfVoice) {
        console.warn("[Senara] Kendi sesini duyma koruması (aktif konuşmada) tetiklendi, yoksayılıyor:", text);
        return;
      }
      
      // Eğer konuşma bittikten hemen sonra kendi yankısını duyduysa yoksay
      if (timeSinceFinished < 1500 && selfVoice) {
        console.warn("[Senara] Kendi sesini duyma koruması (konuşma sonrası yankı) tetiklendi, yoksayılıyor:", text);
        return;
      }

      // Eğer asistan o esnada konuşuyorsa VE bu asistanın kendi sesi değilse (barge-in):
      // Demek ki kullanıcı konuşmaya başladı, hemen asistanın sesini kes ve komutu işle!
      if (speech.isSpeaking) {
        const normText = normalizeTurkish(lowerText);
        const commandWords = [
          "bir", "iki", "uc", "dort", "bes", "alti",
          "birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "altinci",
          "dur", "kes", "sus", "fiyat", "karsilastir", "dolap", "uyar", "ekle", "goster",
          "deterjan", "tisort", "elbise", "pantolon", "kiyafet", "evet", "sepet", "al", "onayla",
          "sepe", "ek", "satin", "temizle", "1", "2", "3", "4", "5", "6", "sep", "liste", "listeyi", "listem"
        ];
        const hasCommand = commandWords.some(cmd => 
          normText === cmd || normText.startsWith(cmd + " ") || normText.endsWith(" " + cmd) || normText.includes(" " + cmd + " ")
        );
        if (!hasCommand) {
          console.warn("[Senara] Araya girme denemesi reddedildi çünkü geçerli bir komut kelimesi içermiyor:", text);
          return;
        }
        console.log("[Senara] Kullanıcı sesli komutla araya girdi! Asistan susturuluyor. Girdi:", text);
        suppressAutoListenRef.current = true; // Konuşma kesilmesinden ötürü auto-listen tetiklenmesin
        forceStopAllSpeech();
      }

      conv.addMessage("user", text);
      setTranscript(text);

      const lower = text.toLowerCase();

      console.log(`[Senara] handleUserInput: "${text}", phase=${phaseRef.current}, products=${productsRef.current.length}`);

      // ── EN ÖNCELİKLİ: Ürün seçimi ──
      // Her zaman güncel productsRef kullan (stale closure yoktur)
      if (productsRef.current.length > 0) {
        const idx = parseOrdinal(lower);
        console.log(`[Senara] parseOrdinal("${lower}") => ${idx}, products.length=${productsRef.current.length}`);
        if (idx != null && productsRef.current[idx]) {
          console.log(`[Senara] Ürün seçiliyor: ${productsRef.current[idx].name}`);
          // Ref üzerinden çağır — stale closure riski sıfır
          await selectProductRef.current?.(productsRef.current[idx]);
          return;
        }
      }

      // ── ALIŞVERİŞ LİSTESİNE EKLEME (Shopping List Add) ──
      if (/(sepet|ekle|ek|sepe|sep|evet|onay|al|olur|istiyorum|ekled|liste|listem)/.test(lower)) {
        if (selectedProductRef.current && phaseRef.current === "product_detail") {
          const added = CartService.add(selectedProductRef.current);
          if (added) {
            say(`Harika! ${selectedProductRef.current.brand || ""} markalı bu ürünü alışveriş listenize ekledim. Alışveriş listenizi görmek için 'listemi göster' diyebilir, satın almak için 'satın al' diyebilirsiniz. Başka bir isteğiniz var mı?`, true);
          } else {
            say("Bu ürün zaten alışveriş listenizde ekli. Satın almak için 'satın al' diyebilirsiniz.", true);
          }
        } else {
          say("Alışveriş listenize ürün ekleyebilmem için önce listelediğim 6 üründen birini seçmelisiniz. Örneğin 'ikinci ürünü göster' diyerek bir ürün seçebilirsiniz.", true);
        }
        return;
      }

      // ── ALİŞVERİŞ LİSTESİNİ GÖSTER / OKU ──
      if (/(sepetimi göster|sepetim|sepetimde ne var|sepeti oku|listemi göster|listem|listenizde ne var|listeyi oku)/.test(lower)) {
        const summary = CartService.buildCartSummary();
        say(summary, true);
        return;
      }

      // ── ALİŞVERİŞ LİSTESİNİ TEMİZLE ──
      if (/(sepeti temizle|sepetimi temizle|sepeti bosalt|listeyi temizle|listemi temizle|listeyi bosalt)/.test(lower)) {
        CartService.clear();
        say("Alışveriş listenizi tamamen boşalttım. Yeni bir ürün aramak için ne istersiniz?", true);
        return;
      }

      // Sipariş ve Satın Alma onayı (Listenizdeki tüm ürünler veya seçili ürün için)
      if (/\b(al|alıyorum|sipariş|onayla|tamam|satın|satin)\b/.test(lower)) {
        const cartItems = CartService.getAll();
        if (cartItems.length > 0) {
          setPhaseSync("ordering");
          cartItems.forEach((item) => {
            if (item.productUrl) {
              window.open(item.productUrl, "_blank");
            }
          });
          say(`Alışveriş listenizdeki ${cartItems.length} ürünü satın alabilmeniz için mağaza sayfalarını yeni sekmelerde açtım. Keyifli alışverişler dilerim!`, false);
          return;
        }
        
        // Eğer sepet boş ama seçili ürün varsa
        if (selectedProductRef.current) {
          setPhaseSync("ordering");
          if (selectedProductRef.current.productUrl) {
            window.open(selectedProductRef.current.productUrl, "_blank");
            say(`Seçili ürünün sayfasını yeni sekmede açtım. Keyifli alışverişler!`, false);
          } else {
            say("Ürünün mağaza sayfasını maalesef bulamadım.", true);
          }
          return;
        }
      }

      // Fiyat karşılaştırma isteği
      if (/(fiyat|karşılaştır|ucuz)/.test(lower) && selectedProductRef.current) {
        await runCompare(selectedProductRef.current);
        return;
      }

      // Uygunluk Koçu (Fit Coach)
      if (/(uyar mı|olur mu|bedenim|yakışır|koçu)/.test(lower) && selectedProductRef.current) {
        const profile = getUserProfile();
        say("Hemen ölçülerinizi ve kalıbı kontrol ediyorum...", false);
        const fitAdvice = await ai.checkFit(selectedProductRef.current.name, profile);
        say(fitAdvice + " Başka bir işlem yapmak ister misiniz?", true);
        return;
      }

      // ── DOLAP HAFIZASI ──
      if (/(dolabıma ekle|dolaba ekle|gardıroba ekle|kaydet)/.test(lower) && selectedProductRef.current) {
        const added = WardrobeService.add(selectedProductRef.current);
        if (added) {
          say(`${selectedProductRef.current.name.substring(0, 50)} dolabınıza eklendi! Başka bir şey yapmak ister misiniz?`, true);
        } else {
          say("Bu ürün zaten dolabınızda kayıtlı.", true);
        }
        return;
      }

      if (/(dolabımda ne var|dolabım|gardırobum|dolabı göster|neler var)/.test(lower)) {
        const summary = WardrobeService.buildWardrobeSummary();
        say(summary, true);
        return;
      }

      if (/(ne giyebilirim|kombin|kombini|ne yakışır|nasıl kombinlerim)/.test(lower)) {
        const wardrobeContext = WardrobeService.buildWardrobeContext();
        const productName = selectedProduct?.name || "genel kıyafet";
        say("Dolabınızı kontrol edip kombin önerisi hazırlıyorum...", false);
        const suggestion = await ai.suggestOutfit(productName, wardrobeContext);
        say(suggestion, true);
        return;
      }

      // Aksi halde yeni arama — ref üzerinden çağır
      await runSearchRef.current?.(text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ai, say],
  );

  const runSearch = useCallback(
    async (text) => {
      try {
        setPhaseSync("processing");
        say(STRINGS.processing, false);
        const intent = await ai.parseIntent(text);
        const list = await search.searchProducts(intent.query, intent.filters);
        setProductsSync(list);
        if (!list.length) {
          handleError(STRINGS.noResults);
          return;
        }
        setPhaseSync("results");
        const summary = buildResultsSummary(list);
        say(summary, true);
      } catch (e) {
        console.error(e);
        handleError();
      }
    },
    [ai, search, say, handleError],
  );
  // Her zaman güncel versiyonu tut
  runSearchRef.current = runSearch;

  const selectProduct = useCallback(
    async (product) => {
      try {
        setSelectedProductSync(product);
        setPhaseSync("product_detail");
        const brandInfo = product.brand ? `${product.brand} markasının` : "";
        say(`${brandInfo} ürününü inceliyorum ve dolabınızla karşılaştırıyorum...`, false);
        
        const wardrobeContext = WardrobeService.buildWardrobeContext();
        
        // Gemini'ye ürün adını gönderip yapay yorum analizi üret
        const reviewPrompt = [
          `Bu ürün hakkında yorum: "${product.name}". Puan: ${product.rating}. Değerlendirme sayısı: ${product.reviewCount}.`,
          `Kumaş kaliteli ve rahat.`,
          `Rengi fotoğraftakiyle aynı.`,
          `Kalıbı biraz dar, bir beden büyük alınmalı.`
        ];
        
        const [imgDesc, reviewSet, wardrobeMatch] = await Promise.all([
          ai.analyzeImage(product.imageUrl).catch(err => {
            console.error("[Senara] Görsel analiz hatası:", err);
            return "Görsel bilgisi alınamadı.";
          }),
          ai.analyzeReviews(reviewPrompt).catch(err => {
            console.error("[Senara] Yorum analiz hatası:", err);
            return { score: product.rating || 4.5, positive: ["ürün genel olarak beğenilmiş"], negative: [] };
          }),
          ai.matchWithWardrobe(product.name, wardrobeContext || "").catch(err => {
            console.error("[Senara] Dolap eşleştirme hatası:", err);
            return "";
          }),
        ]);
        setImageDescription(imgDesc);
        setReviewAnalysis(reviewSet);
        
        let text = buildProductDetailSummary(product, imgDesc, reviewSet);
        
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
  // Her zaman güncel versiyonu tut
  selectProductRef.current = selectProduct;

  const runCompare = useCallback(
    async (product) => {
      if (!product) return;
      try {
        setPhaseSync("comparing");
        say("Trendyol'da benzer ürünleri tarıyorum, en uygun fiyatları buluyorum...", false);
        const results = await search.comparePrice(product);
        setPriceResultsSync(results);
        
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

  const startListening = useCallback((keepSpeechRunning = false) => {
    if (!speech.isSupported) {
      handleError(STRINGS.errorBrowserUnsupported);
      return;
    }

    if (!keepSpeechRunning) {
      suppressAutoListenRef.current = true; // cancel'dan gelecek onend'i bastır
      forceStopAllSpeech();
    }

    setError(null);
    setPhaseSync("listening");
    setTranscript("");

    if (!handsFreeRef.current) setHandsFreeSync(true);

    speech.startListening(
      (text) => {
        if (!text) {
          setError(STRINGS.errorNoSpeech);
          setPhaseSync("error");
          say(STRINGS.errorNoSpeech, false);
          return;
        }
        setError(null);
        handleUserInput(text);
      },
      (err) => {
        console.error("[Senara] Speech recognition error:", err);
        setError(STRINGS.errorNoSpeech);
        setPhaseSync("error");
        say(STRINGS.errorNoSpeech, false);
      },
      () => {
        console.log("[Senara] Native recognition session ended.");
      }
    );
  }, [speech, handleError, handleUserInput, forceStopAllSpeech]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const toggleListening = useCallback(() => {
    if (speech.isListening) {
      // Zaten dinliyorsa durdur
      suppressAutoListenRef.current = true;
      speech.stopListening();
      setPhaseSync("idle");
      setHandsFreeSync(false);
    } else {
      // Asistan konuşuyor olsa bile — hemen kes, dinlemeye geç
      // (Kullanıcı listeyi dinlerken "birinci" demek isteyebilir)
      suppressAutoListenRef.current = false;
      forceStopAllSpeech();
      startListening();
    }
  }, [speech, startListening, forceStopAllSpeech]);

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
    setHandsFreeSync(false);
  }, [speech, forceStopAllSpeech]);

  // ── KLAVYE ERİŞİLEBİLİRLİĞİ (SPACE BAR TO TOGGLE, CTRL TO INTERRUPT) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        toggleListening();
      }
      if (e.key === "Control") {
        e.preventDefault();
        suppressAutoListenRef.current = true;
        forceStopAllSpeech();
        setHandsFreeSync(true);
        say("Sizi dinliyorum.", true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleListening, say, forceStopAllSpeech]);

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
  
  const ordinals = ["Birinci", "İkinci", "Üçüncü", "Dördüncü", "Beşinci", "Altıncı"];
  let text = `Sizin için ${list.length} ürün seçtim. `;
  
  let lastCategory = "";
  list.forEach((p, i) => {
    const cat = p.categoryName || "";
    if (cat && cat !== lastCategory) {
      text += `${cat}: `;
      lastCategory = cat;
    }
    const ord = ordinals[i] || `${i + 1}.`;
    const brand = p.brand || "";
    const shortName = p.name.substring(brand.length).trim().substring(0, 40);
    text += `${ord}, ${brand} marka ${shortName}, ${p.price} TL, ${p.rating} puan. `;
  });
  
  text += `Detay ve yorumları duymak için ürün numarasını söyleyin. Örneğin birinci veya beşinci.`;
  return text;
}

function buildProductDetailSummary(product, imgDesc, review) {
  const brand = product.brand || "";
  const reviewCount = product.reviewCount ?? 0;
  
  const positive = review.positive && review.positive.length > 0 ? review.positive[0] : "ürün güzel";
  const negative = review.negative && review.negative.length > 0 ? review.negative[0] : "";
  
  let summary = brand ? `${brand} markasından bu ürün. ` : "";
  summary += `${imgDesc} `;
  summary += `${reviewCount} değerlendirme var, puanı ${review.score}. `;
  summary += `Kullanıcılar en çok "${positive}" demiş. `;
  if (negative) summary += `Ancak bazıları "${negative}" şeklinde şikayette bulunmuş. `;
  if (review.sizeAdvice) summary += `Beden tavsiyesi: ${review.sizeAdvice} `;
  
  summary += `Bu ürünü alışveriş sepetinize eklemek ister misiniz? Evet derseniz sepetinize ekleyeceğim. Yoksa 'fiyat karşılaştır' mı diyelim?`;
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

function normalizeTurkish(str) {
  if (!str) return "";
  return str.toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g");
}

function parseOrdinal(text) {
  const t = normalizeTurkish(text).trim();
  
  // Kelime kelime kontrol et (en kararlı ve en sağlam yöntemdir)
  const words = t.split(/\s+/);
  for (const w of words) {
    if (/birinci|1\.|ilk|bir$/.test(w) || w === "1") return 0;
    if (/ikinci|2\.|iki$/.test(w) || w === "2") return 1;
    if (/ucuncu|3\.|uc$/.test(w) || w === "3") return 2;
    if (/dorduncu|4\.|dort$/.test(w) || w === "4") return 3;
    if (/besinci|5\.|bes$/.test(w) || w === "5") return 4;
    if (/altinci|6\.|alti$/.test(w) || w === "6") return 5;
  }

  // Cümlenin tamamında regex ile arama (fallback)
  if (/\b1\b|birinci|ilk|1\./.test(t)) return 0;
  if (/\b2\b|ikinci|2\./.test(t)) return 1;
  if (/\b3\b|ucuncu|3\./.test(t)) return 2;
  if (/\b4\b|dorduncu|4\./.test(t)) return 3;
  if (/\b5\b|besinci|5\./.test(t)) return 4;
  if (/\b6\b|altinci|6\./.test(t)) return 5;

  return null;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function isSelfVoice(transcript, assistantText) {
  if (!assistantText) return false;
  
  const t = normalizeTurkish(transcript).trim();
  const a = normalizeTurkish(assistantText).trim();
  
  // Normalize edilmiş komut kelimeleri
  const commandWords = [
    "bir", "iki", "uc", "dort", "bes", "alti",
    "birinci", "ikinci", "ucuncu", "dorduncu", "besinci", "altinci",
    "dur", "kes", "sus", "fiyat", "karsilastir", "dolap", "uyar", "ekle", "goster",
    "deterjan", "tisort", "elbise", "pantolon", "kiyafet", "evet", "sepet", "al", "onayla", "satin",
    "1", "2", "3", "4", "5", "6", "sepe", "ek", "temizle", "sep", "liste", "listeyi", "listem"
  ];
  
  // Eğer kullanıcının girdisinde komut kelimelerinden biri geçiyorsa kendi sesimiz değildir!
  for (const cmd of commandWords) {
    if (t === cmd || t.startsWith(cmd + " ") || t.endsWith(" " + cmd) || t.includes(" " + cmd + " ")) {
      return false;
    }
  }

  // Eğer asistan metni kullanıcının duyduğu cümleyi tamamen içeriyorsa kendi sesidir
  if (a.includes(t)) {
    return true;
  }
  
  // Kelime çakışması oranı
  const tWords = t.split(/\s+/);
  let matchCount = 0;
  for (const word of tWords) {
    if (word.length > 2 && a.includes(word)) {
      matchCount++;
    }
  }
  
  if (tWords.length > 0 && (matchCount / tWords.length) > 0.4) {
    return true;
  }
  
  return false;
}
