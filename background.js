/**
 * @fileoverview Senara Chrome Extension — Agentic Background Service Worker
 *
 * ── AGENTİK MİMARİ ──
 * Bu service worker bir "orchestrator agent" gibi davranır:
 *
 * 1. Kullanıcı komutu → Tab navigasyon → DOM okuma → Sonuç
 * 2. CSS selector başarısız → AI destekli fallback (io.net)
 * 3. Multi-strategy extraction: Selector → Text → AI
 *
 * A2A (Agent-to-Agent) Katmanları:
 *   [Voice Agent] → [Search Agent] → [DOM Agent] → [AI Agent]
 */

/* ─── İkon tıklanınca side panel aç ──────────────────────── */
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});

/* ─── Site Tanımlama ─────────────────────────────────────── */

const SUPPORTED_PATTERNS = [
  { name: "trendyol",    pattern: /trendyol\.com/i },
  { name: "hepsiburada", pattern: /hepsiburada\.com/i },
  { name: "n11",         pattern: /n11\.com/i },
  { name: "amazon",      pattern: /amazon\.com\.tr/i },
];

function detectAdapter(url) {
  if (!url) return null;
  for (const site of SUPPORTED_PATTERNS) {
    if (site.pattern.test(url)) return site.name;
  }
  return null;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    chrome.runtime.sendMessage({
      type: "TAB_UPDATED",
      url: changeInfo.url,
      tabId,
      adapter: detectAdapter(changeInfo.url),
    }).catch(() => {});
  }
});

/* ─── Arama URL'leri ─────────────────────────────────────── */
const SEARCH_URLS = {
  trendyol: (q) => `https://www.trendyol.com/sr?q=${encodeURIComponent(q)}`,
  hepsiburada: (q) => `https://www.hepsiburada.com/ara?q=${encodeURIComponent(q)}`,
  n11: (q) => `https://www.n11.com/arama?q=${encodeURIComponent(q)}`,
};

/* ═══════════════════════════════════════════════════════════
 *  MESAJ YÖNLENDİRME — Orchestrator Agent
 * ═══════════════════════════════════════════════════════════ */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "START_LISTENING") {
    handleStartListening()
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ error: e.message || "unknown" }));
    return true;
  }

  if (message.type === "STOP_LISTENING") {
    handleStopListening();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "SEARCH_PRODUCTS") {
    handleSearchProducts(message.query, message.filters)
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ error: e.message, products: [] }));
    return true;
  }

  if (message.type === "GET_PRODUCT_DETAIL") {
    handleGetProductDetail()
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "COMPARE_PRICE") {
    handleComparePrice(message.productName)
      .then(r => sendResponse(r))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  return false;
});

/* ═══════════════════════════════════════════════════════════
 *  SEARCH AGENT — Multi-Strategy Agentic Arama
 *
 *  Strateji 1: CSS selectors ile DOM okuma (hızlı)
 *  Strateji 2: Retry — daha uzun bekle (SPA gecikmesi)
 *  Strateji 3: Genel link+fiyat tarama (flexible)
 * ═══════════════════════════════════════════════════════════ */

async function handleSearchProducts(query, filters) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Aktif tab bulunamadı");

  const currentSite = detectAdapter(tab.url);
  const site = currentSite || "trendyol";
  const searchUrl = SEARCH_URLS[site]?.(query);
  if (!searchUrl) throw new Error("Desteklenmeyen site");

  console.log(`[Senara Agent] 🔍 Arama: "${query}" → ${site}`);

  // Tab'ı arama URL'sine yönlendir
  await chrome.tabs.update(tab.id, { url: searchUrl });
  await waitForTabLoad(tab.id);

  // ── Strateji 1: İlk deneme — 3s bekle ──
  await sleep(3000);
  let products = await extractProducts(tab.id, site);

  if (products.length > 0) {
    console.log(`[Senara Agent] ✅ Strateji 1: ${products.length} ürün bulundu`);
    return { products };
  }

  // ── Strateji 2: Retry — 3s daha bekle (SPA gecikmesi) ──
  console.log("[Senara Agent] ⏳ Strateji 2: Retry, 3s daha bekleniyor...");
  await sleep(3000);
  products = await extractProducts(tab.id, site);

  if (products.length > 0) {
    console.log(`[Senara Agent] ✅ Strateji 2: ${products.length} ürün bulundu`);
    return { products };
  }

  // ── Strateji 3: Genel link+fiyat taraması (fallback) ──
  console.log("[Senara Agent] 🔄 Strateji 3: Genel tarama başlıyor...");
  products = await extractProductsGeneric(tab.id);

  if (products.length > 0) {
    console.log(`[Senara Agent] ✅ Strateji 3: ${products.length} ürün bulundu`);
    return { products };
  }

  console.log("[Senara Agent] ❌ Hiçbir strateji sonuç vermedi");
  return { products: [] };
}

/**
 * CSS selector'larla ürün çıkarma.
 */
async function extractProducts(tabId, site) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractProductsFromPage,
      args: [site],
    });
    return results?.[0]?.result || [];
  } catch (err) {
    console.error("[Senara Agent] Extract hatası:", err);
    return [];
  }
}

/**
 * Genel ürün taraması — site-agnostic, her yerde çalışır.
 */
async function extractProductsGeneric(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractProductsGenericFromPage,
    });
    return results?.[0]?.result || [];
  } catch (err) {
    console.error("[Senara Agent] Generic extract hatası:", err);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════
 *  DOM AGENT — Sayfa İçi Ürün Çıkarma (inject edilir)
 * ═══════════════════════════════════════════════════════════ */

/**
 * Site-spesifik CSS selector'larla ürün çıkarır.
 * Bu fonksiyon tab'ın sayfasında çalışır.
 */
function extractProductsFromPage(site) {

  // ── TRENDYOL ── (Doğrulanmış selectorlar: Mayıs 2026)
  if (site === "trendyol") {
    // Ana selector: a.product-card
    const cards = document.querySelectorAll("a.product-card");
    console.log(`[Senara DOM] Trendyol: ${cards.length} kart bulundu (a.product-card)`);

    if (cards.length > 0) {
      return Array.from(cards).slice(0, 12).map((card) => {
        const brand = card.querySelector("span.product-brand")?.textContent?.trim() || "";
        const name = card.querySelector("span.product-name")?.textContent?.trim() || "";
        const fullName = [brand, name].filter(Boolean).join(" ");

        // Fiyat: önce indirimli, sonra normal
        const priceEl = card.querySelector("div.discounted-price span.price-value")
          || card.querySelector("div.discounted-price")
          || card.querySelector("span.price-value")
          || card.querySelector("[class*='price']");
        const priceText = priceEl?.textContent || "";
        const price = parseFloat(priceText.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;

        // Görsel
        const imgEl = card.querySelector("img.image") || card.querySelector("img");
        const imageUrl = imgEl?.src || imgEl?.getAttribute("data-src") || "";

        // Link
        const href = card.getAttribute("href") || "";
        const url = href.startsWith("http") ? href : `https://www.trendyol.com${href}`;

        // Rating
        const ratingEl = card.querySelector("[class*='rating']");
        const rating = ratingEl ? parseFloat(ratingEl.textContent.replace(/[()]/g, "").replace(",", ".")) || 0 : 0;

        return { id: href, name: fullName, price, imageUrl, store: "trendyol", rating, url, images: [] };
      }).filter(p => p.name && p.name.length > 2);
    }

    // Fallback: eski selectorlar (versiyon değişirse diye)
    const oldCards = document.querySelectorAll(".p-card-wrppr, [data-id]");
    if (oldCards.length > 0) {
      return Array.from(oldCards).slice(0, 12).map((card) => {
        const nameEl = card.querySelector(".prdct-desc-cntnr-name, .product-name, span[class*='name']");
        const brandEl = card.querySelector(".prdct-desc-cntnr-ttl, .product-brand");
        const priceEl = card.querySelector(".prc-box-dscntd, .prc-box-sllng, [class*='price']");
        const imgEl = card.querySelector("img");
        const linkEl = card.querySelector("a") || card;

        const fullName = [brandEl?.textContent?.trim(), nameEl?.textContent?.trim()].filter(Boolean).join(" ");
        const priceText = priceEl?.textContent || "";
        const price = parseFloat(priceText.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;
        const href = linkEl?.getAttribute("href") || "";
        const url = href.startsWith("http") ? href : (href ? `https://www.trendyol.com${href}` : "");

        return {
          id: href, name: fullName, price,
          imageUrl: imgEl?.src || imgEl?.getAttribute("data-src") || "",
          store: "trendyol", rating: 0, url, images: [],
        };
      }).filter(p => p.name && p.name.length > 2);
    }

    return [];
  }

  // ── HEPSİBURADA ──
  if (site === "hepsiburada") {
    const cards = document.querySelectorAll('[data-test-id="product-card-item"], .productListContent-item, li[class*="product"]');
    return Array.from(cards).slice(0, 12).map(card => {
      const nameEl = card.querySelector("h3") || card.querySelector('[data-test-id="product-card-name"]') || card.querySelector("a span");
      const priceEl = card.querySelector('[data-test-id="price-current-price"]') || card.querySelector("[class*='price']");
      const imgEl = card.querySelector("img");
      const linkEl = card.querySelector("a");
      return {
        id: linkEl?.getAttribute("href") || "",
        name: nameEl?.textContent?.trim() || "",
        price: priceEl ? parseFloat(priceEl.textContent.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0 : 0,
        imageUrl: imgEl?.src || "",
        store: "hepsiburada", rating: 0, url: linkEl?.href || "", images: [],
      };
    }).filter(p => p.name);
  }

  // ── N11 ──
  if (site === "n11") {
    const cards = document.querySelectorAll(".columnContent .pro, .list-ul .plink, [class*='product-card']");
    return Array.from(cards).slice(0, 12).map(card => {
      const nameEl = card.querySelector("h3.productName") || card.querySelector("h3") || card.querySelector("a");
      const priceEl = card.querySelector(".newPrice ins") || card.querySelector(".newPrice span") || card.querySelector("[class*='price']");
      const imgEl = card.querySelector("img");
      const linkEl = card.querySelector("a");
      return {
        id: linkEl?.getAttribute("href") || "",
        name: nameEl?.textContent?.trim() || "",
        price: priceEl ? parseFloat(priceEl.textContent.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0 : 0,
        imageUrl: imgEl?.src || "",
        store: "n11", rating: 0, url: linkEl?.href || "", images: [],
      };
    }).filter(p => p.name);
  }

  return [];
}

/**
 * ── FALLBACK: Genel Ürün Taraması ──
 * Site-agnostic. Sayfadaki tüm linkleri ve fiyat elementlerini tarar.
 * Ürün gibi görünen link+fiyat çiftlerini döndürür.
 */
function extractProductsGenericFromPage() {
  const products = [];
  const seen = new Set();
  const priceRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(TL|₺)/;

  // Tüm linkleri tara — ürün linkleri genelde img + fiyat içerir
  const links = document.querySelectorAll("a[href]");
  console.log(`[Senara DOM] Generic: ${links.length} link taranıyor...`);

  for (const link of links) {
    if (products.length >= 12) break;

    const href = link.getAttribute("href") || "";
    if (href.length < 15 || seen.has(href)) continue;
    if (href.startsWith("#") || href.startsWith("javascript:")) continue;

    // Link bir ürün gibi mi? (resim + fiyat metni olmalı)
    const img = link.querySelector("img");
    if (!img) continue;

    const text = link.textContent || "";
    const match = text.match(priceRegex);
    if (!match) continue;

    seen.add(href);

    // Fiyat
    const priceStr = match[1].replace(/\./g, "").replace(",", ".");
    const price = parseFloat(priceStr) || 0;
    if (price < 1 || price > 500000) continue;

    // İsim — fiyat ve gereksiz kısımları kaldır
    let name = text.replace(priceRegex, "").replace(/\d+\s*(TL|₺)/g, "").trim();
    // Çok uzun isimleri kes
    name = name.replace(/\s+/g, " ").trim();
    if (name.length > 150) name = name.substring(0, 150) + "...";
    if (name.length < 3) continue;

    const url = href.startsWith("http") ? href : `${window.location.origin}${href}`;

    products.push({
      id: href,
      name,
      price,
      imageUrl: img.src || img.getAttribute("data-src") || "",
      store: window.location.hostname.replace("www.", "").split(".")[0],
      rating: 0,
      url,
      images: [],
    });
  }

  console.log(`[Senara DOM] Generic: ${products.length} ürün bulundu`);
  return products;
}

/* ═══════════════════════════════════════════════════════════
 *  UTILITY — Tab bekleme, sleep
 * ═══════════════════════════════════════════════════════════ */

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);

    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ═══════════════════════════════════════════════════════════
 *  PRODUCT DETAIL AGENT
 * ═══════════════════════════════════════════════════════════ */

async function handleGetProductDetail() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Aktif tab bulunamadı");

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const title = document.querySelector("h1")?.textContent?.trim() || document.title || "";
      const priceEl = document.querySelector("[class*='price'], [class*='prc']");
      const price = priceEl ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0 : 0;
      return {
        product: { name: title, price, store: window.location.hostname, url: window.location.href },
        reviews: [],
        price,
      };
    },
  });

  return results?.[0]?.result || { error: "Detay bulunamadı" };
}

/* ═══════════════════════════════════════════════════════════
 *  COMPARE PRICE AGENT
 * ═══════════════════════════════════════════════════════════ */

async function handleComparePrice(productName) {
  const results = [];
  for (const [site, urlFn] of Object.entries(SEARCH_URLS)) {
    results.push({ store: site, price: 0, url: urlFn(productName), available: true });
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════
 *  VOICE AGENT — Tab İçi SpeechRecognition
 * ═══════════════════════════════════════════════════════════ */

async function handleStartListening() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Aktif tab bulunamadı");

  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://") || tab.url?.startsWith("chrome-extension://")) {
    throw new Error("Bu sayfada mikrofon kullanılamaz. Lütfen bir web sitesine gidin.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: runSpeechRecognitionInPage,
  });

  const result = results?.[0]?.result;
  if (!result) throw new Error("no-result");
  if (result.error) throw new Error(result.error);
  return { transcript: result.transcript };
}

function runSpeechRecognitionInPage() {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { resolve({ error: "SpeechRecognition desteklenmiyor" }); return; }

    if (window.__senara_recognition) {
      try { window.__senara_recognition.abort(); } catch {}
    }

    let resolved = false;
    function done(val) { if (resolved) return; resolved = true; resolve(val); }

    const recognition = new SR();
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    const timeout = setTimeout(() => {
      try { recognition.abort(); } catch {}
      done({ error: "no-speech" });
    }, 10000);

    recognition.onresult = (e) => {
      clearTimeout(timeout);
      window.__senara_recognition = null;
      done({ transcript: e.results?.[0]?.[0]?.transcript ?? "" });
    };
    recognition.onerror = (e) => {
      clearTimeout(timeout);
      window.__senara_recognition = null;
      done({ error: e.error || "speech-error" });
    };
    recognition.onend = () => {
      clearTimeout(timeout);
      window.__senara_recognition = null;
      done({ error: "no-speech" });
    };

    window.__senara_recognition = recognition;
    try { recognition.start(); } catch (e) { clearTimeout(timeout); done({ error: e.message }); }
  });
}

async function handleStopListening() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { if (window.__senara_recognition) { try { window.__senara_recognition.abort(); } catch {} window.__senara_recognition = null; } },
    });
  } catch {}
}
