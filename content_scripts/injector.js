/**
 * @fileoverview Senara Chrome Extension — Content Script Injector
 *
 * Tüm desteklenen e-ticaret sitelerinde çalışır.
 * Sayfa yüklendiğinde hangi sitede olduğunu anlar ve
 * background'dan gelen mesajlara göre DOM'dan veri çıkarır.
 *
 * Desteklenen mesaj tipleri:
 *   - SEARCH_PRODUCTS:    Arama URL'ini oluşturur, sayfayı fetch eder, parse eder
 *   - GET_PRODUCT_DETAIL: Aktif sayfanın DOM'undan ürün bilgilerini çıkarır
 *   - COMPARE_PRICE:      Her site için fiyat araması yapıp karşılaştırır
 *
 * @module content_scripts/injector
 */

/* ─── Adapter Tanımları (inline, module import yerine) ──────── */

/**
 * Her adapter site-spesifik DOM parse ve URL üretimi yapar.
 * Content script'ler ES module desteklemediği için adapter
 * kodları burada inline tanımlanır.
 */

const adapters = {
  trendyol: {
    siteName: "trendyol",
    urlPattern: /trendyol\.com/i,

    extractProduct(doc) {
      try {
        const name =
          doc.querySelector("[data-drroot] h1")?.textContent?.trim() ||
          doc.querySelector(".pr-new-br span")?.textContent?.trim() ||
          "";
        const priceEl =
          doc.querySelector(".prc-dsc") ||
          doc.querySelector(".product-price-container .prc-slg");
        const price = priceEl
          ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          : 0;
        const images = Array.from(
          doc.querySelectorAll(".base-product-image img")
        ).map((img) => img.src || img.getAttribute("data-src") || "");
        const ratingEl = doc.querySelector(".rnr-cm-rvw span");
        const rating = ratingEl
          ? parseFloat(ratingEl.textContent.replace(",", ".")) || 0
          : 0;

        return {
          id: window.location.pathname,
          name,
          price,
          imageUrl: images[0] || "",
          store: "trendyol",
          rating,
          url: window.location.href,
          images: images.filter(Boolean),
        };
      } catch (err) {
        console.error("[Senara CS] Trendyol extractProduct hatası:", err);
        return { id: "", name: "", price: 0, imageUrl: "", store: "trendyol", rating: 0, url: "", images: [] };
      }
    },

    extractReviews(doc) {
      try {
        return Array.from(
          doc.querySelectorAll(".comment-text .rnr-com-tx")
        ).map((el) => el.innerText?.trim() || "").filter(Boolean);
      } catch (err) {
        console.error("[Senara CS] Trendyol extractReviews hatası:", err);
        return [];
      }
    },

    extractPrice(doc) {
      try {
        const priceEl =
          doc.querySelector(".prc-dsc") ||
          doc.querySelector(".product-price-container .prc-slg");
        return priceEl
          ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          : 0;
      } catch {
        return 0;
      }
    },

    buildSearchUrl(query, filters = {}) {
      const params = new URLSearchParams({ q: query });
      if (filters.maxPrice) params.set("prc", `0-${filters.maxPrice}`);
      return `https://www.trendyol.com/sr?${params.toString()}`;
    },

    /**
     * Arama sonuç sayfasından ürün listesini parse eder.
     * @param {Document} doc
     * @returns {Array}
     */
    extractSearchResults(doc) {
      try {
        const cards = doc.querySelectorAll(".p-card-wrppr");
        return Array.from(cards).slice(0, 10).map((card) => {
          const nameEl = card.querySelector(".prdct-desc-cntnr-name");
          const priceEl = card.querySelector(".prc-box-dscntd") || card.querySelector(".prc-box-sllng");
          const imgEl = card.querySelector("img.p-card-img");
          const linkEl = card.querySelector("a");
          const ratingEl = card.querySelector(".ratingCount");

          return {
            id: linkEl?.getAttribute("href") || "",
            name: nameEl?.textContent?.trim() || "",
            price: priceEl
              ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
              : 0,
            imageUrl: imgEl?.src || imgEl?.getAttribute("data-src") || "",
            store: "trendyol",
            rating: ratingEl
              ? parseFloat(ratingEl.textContent.replace(/[()]/g, "").replace(",", ".")) || 0
              : 0,
            url: linkEl ? `https://www.trendyol.com${linkEl.getAttribute("href")}` : "",
            images: [],
          };
        }).filter((p) => p.name);
      } catch (err) {
        console.error("[Senara CS] Trendyol extractSearchResults hatası:", err);
        return [];
      }
    },
  },

  hepsiburada: {
    siteName: "hepsiburada",
    urlPattern: /hepsiburada\.com/i,

    extractProduct(doc) {
      try {
        const name =
          doc.querySelector("h1.product-name")?.textContent?.trim() ||
          doc.querySelector('[data-bind="text: name"]')?.textContent?.trim() ||
          doc.querySelector("h1")?.textContent?.trim() ||
          "";
        const priceEl =
          doc.querySelector(".product-price .price") ||
          doc.querySelector('[data-bind="markupText: currentPriceBeforePoint"]');
        const price = priceEl
          ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          : 0;
        const images = Array.from(
          doc.querySelectorAll(".product-image img")
        ).map((img) => img.src || img.getAttribute("data-src") || "");
        const ratingEl = doc.querySelector(".ratings .rating") ||
          doc.querySelector(".hermes-Rating-stars");
        const rating = ratingEl
          ? parseFloat(ratingEl.textContent?.replace(",", ".")) || 0
          : 0;

        return {
          id: window.location.pathname,
          name,
          price,
          imageUrl: images[0] || "",
          store: "hepsiburada",
          rating,
          url: window.location.href,
          images: images.filter(Boolean),
        };
      } catch (err) {
        console.error("[Senara CS] Hepsiburada extractProduct hatası:", err);
        return { id: "", name: "", price: 0, imageUrl: "", store: "hepsiburada", rating: 0, url: "", images: [] };
      }
    },

    extractReviews(doc) {
      try {
        return Array.from(
          doc.querySelectorAll(".comment .hermes-ReviewCard-description")
        ).map((el) => el.innerText?.trim() || "").filter(Boolean);
      } catch (err) {
        console.error("[Senara CS] Hepsiburada extractReviews hatası:", err);
        return [];
      }
    },

    extractPrice(doc) {
      try {
        const priceEl =
          doc.querySelector(".product-price .price") ||
          doc.querySelector('[data-bind="markupText: currentPriceBeforePoint"]');
        return priceEl
          ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          : 0;
      } catch {
        return 0;
      }
    },

    buildSearchUrl(query, filters = {}) {
      const params = new URLSearchParams({ q: query });
      return `https://www.hepsiburada.com/ara?${params.toString()}`;
    },

    extractSearchResults(doc) {
      try {
        const cards = doc.querySelectorAll('[data-test-id="product-card-item"]') ||
          doc.querySelectorAll(".productListContent-item");
        return Array.from(cards).slice(0, 10).map((card) => {
          const nameEl = card.querySelector("h3") || card.querySelector('[data-test-id="product-card-name"]');
          const priceEl = card.querySelector('[data-test-id="price-current-price"]') ||
            card.querySelector(".product-price");
          const imgEl = card.querySelector("img");
          const linkEl = card.querySelector("a");

          return {
            id: linkEl?.getAttribute("href") || "",
            name: nameEl?.textContent?.trim() || "",
            price: priceEl
              ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
              : 0,
            imageUrl: imgEl?.src || "",
            store: "hepsiburada",
            rating: 0,
            url: linkEl?.href || "",
            images: [],
          };
        }).filter((p) => p.name);
      } catch (err) {
        console.error("[Senara CS] Hepsiburada extractSearchResults hatası:", err);
        return [];
      }
    },
  },

  n11: {
    siteName: "n11",
    urlPattern: /n11\.com/i,

    extractProduct(doc) {
      try {
        const name =
          doc.querySelector(".proName h1")?.textContent?.trim() ||
          doc.querySelector("h1.product-name")?.textContent?.trim() ||
          "";
        const priceEl =
          doc.querySelector(".newPrice ins") ||
          doc.querySelector(".newPrice span");
        const price = priceEl
          ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          : 0;
        const images = Array.from(
          doc.querySelectorAll("#productMainPicture img")
        ).map((img) => img.src || img.getAttribute("data-src") || "");
        const ratingEl = doc.querySelector(".ratingCont .ratingScore");
        const rating = ratingEl
          ? parseFloat(ratingEl.textContent?.replace(",", ".")) || 0
          : 0;

        return {
          id: window.location.pathname,
          name,
          price,
          imageUrl: images[0] || "",
          store: "n11",
          rating,
          url: window.location.href,
          images: images.filter(Boolean),
        };
      } catch (err) {
        console.error("[Senara CS] N11 extractProduct hatası:", err);
        return { id: "", name: "", price: 0, imageUrl: "", store: "n11", rating: 0, url: "", images: [] };
      }
    },

    extractReviews(doc) {
      try {
        return Array.from(
          doc.querySelectorAll(".comment-body .comment-text")
        ).map((el) => el.innerText?.trim() || "").filter(Boolean);
      } catch (err) {
        console.error("[Senara CS] N11 extractReviews hatası:", err);
        return [];
      }
    },

    extractPrice(doc) {
      try {
        const priceEl =
          doc.querySelector(".newPrice ins") ||
          doc.querySelector(".newPrice span");
        return priceEl
          ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
          : 0;
      } catch {
        return 0;
      }
    },

    buildSearchUrl(query, filters = {}) {
      return `https://www.n11.com/arama?q=${encodeURIComponent(query)}`;
    },

    extractSearchResults(doc) {
      try {
        const cards = doc.querySelectorAll(".columnContent .pro");
        return Array.from(cards).slice(0, 10).map((card) => {
          const nameEl = card.querySelector("h3.productName");
          const priceEl = card.querySelector(".newPrice ins") || card.querySelector(".newPrice span");
          const imgEl = card.querySelector("img");
          const linkEl = card.querySelector("a");

          return {
            id: linkEl?.getAttribute("href") || "",
            name: nameEl?.textContent?.trim() || "",
            price: priceEl
              ? parseFloat(priceEl.textContent.replace(/[^\d,]/g, "").replace(",", ".")) || 0
              : 0,
            imageUrl: imgEl?.src || "",
            store: "n11",
            rating: 0,
            url: linkEl?.href || "",
            images: [],
          };
        }).filter((p) => p.name);
      } catch (err) {
        console.error("[Senara CS] N11 extractSearchResults hatası:", err);
        return [];
      }
    },
  },
};

/* ─── Mevcut siteyi tespit et ───────────────────────────────── */

/**
 * Mevcut sayfa URL'sine bakarak hangi adapter'ın kullanılacağını belirler.
 * @returns {object|null} Adapter objesi veya null
 */
function detectCurrentAdapter() {
  const url = window.location.href;
  for (const key of Object.keys(adapters)) {
    if (adapters[key].urlPattern.test(url)) {
      return adapters[key];
    }
  }
  return null;
}

const currentAdapter = detectCurrentAdapter();
if (currentAdapter) {
  console.log(`[Senara CS] İnjektör yüklendi. Site: ${currentAdapter.siteName}, URL: ${window.location.href}`);
} else {
  console.log("[Senara CS] İnjektör yüklendi ama desteklenen site tespit edilemedi. URL:", window.location.href);
}

/* ─── Mesaj dinleyici ───────────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Senara CS] Mesaj alındı:", message.type);

  switch (message.type) {
    case "SEARCH_PRODUCTS":
      handleSearchProducts(message, sendResponse);
      return true; // async

    case "GET_PRODUCT_DETAIL":
      handleGetProductDetail(message, sendResponse);
      return true; // async

    case "COMPARE_PRICE":
      handleComparePrice(message, sendResponse);
      return true; // async

    default:
      console.log("[Senara CS] Bilinmeyen mesaj tipi:", message.type);
      return false;
  }
});

/* ─── Mesaj İşleyiciler ─────────────────────────────────────── */

/**
 * SEARCH_PRODUCTS: Belirtilen sorguyu mevcut siteyle arar.
 * Arama sayfasını fetch ile çeker ve DOM'u parse eder.
 */
async function handleSearchProducts(message, sendResponse) {
  try {
    const adapter = currentAdapter;
    if (!adapter) {
      sendResponse({ error: "Bu sitede arama desteklenmiyor", products: [] });
      return;
    }

    const searchUrl = adapter.buildSearchUrl(message.query, message.filters || {});
    console.log("[Senara CS] Arama URL:", searchUrl);

    const response = await fetch(searchUrl, {
      credentials: "same-origin",
      headers: { "Accept": "text/html" },
    });
    const html = await response.text();

    // HTML'i DOM olarak parse et
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const products = adapter.extractSearchResults(doc);
    console.log("[Senara CS] Bulunan ürün sayısı:", products.length);

    sendResponse({ products });
  } catch (err) {
    console.error("[Senara CS] SEARCH_PRODUCTS hatası:", err);
    sendResponse({ error: err.message, products: [] });
  }
}

/**
 * GET_PRODUCT_DETAIL: Mevcut sayfanın DOM'undan ürün detaylarını çıkarır.
 */
async function handleGetProductDetail(message, sendResponse) {
  try {
    const adapter = currentAdapter;
    if (!adapter) {
      sendResponse({ error: "Bu sitede ürün detayı desteklenmiyor" });
      return;
    }

    const product = adapter.extractProduct(document);
    const reviews = adapter.extractReviews(document);
    const price = adapter.extractPrice(document);

    console.log("[Senara CS] Ürün detayı çıkarıldı:", product.name);

    sendResponse({
      product,
      reviews,
      price,
    });
  } catch (err) {
    console.error("[Senara CS] GET_PRODUCT_DETAIL hatası:", err);
    sendResponse({ error: err.message });
  }
}

/**
 * COMPARE_PRICE: Her site için arama yapıp fiyatları karşılaştırır.
 * Verilen ürün adını her adapter'ın arama URL'inde arayıp
 * ilk sonuçtaki fiyatı döndürür.
 */
async function handleComparePrice(message, sendResponse) {
  try {
    const productName = message.productName;
    console.log("[Senara CS] Fiyat karşılaştırma başlıyor:", productName);

    const results = [];

    for (const key of Object.keys(adapters)) {
      const adapter = adapters[key];
      try {
        const searchUrl = adapter.buildSearchUrl(productName);
        console.log(`[Senara CS] ${adapter.siteName} aranıyor:`, searchUrl);

        const response = await fetch(searchUrl, {
          credentials: "omit",
          headers: { "Accept": "text/html" },
        });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const products = adapter.extractSearchResults(doc);
        const firstProduct = products[0];

        results.push({
          store: adapter.siteName,
          price: firstProduct?.price || 0,
          shipping: 0, // Kargo bilgisi ayrıca çıkarılabilir
          url: firstProduct?.url || searchUrl,
          available: !!firstProduct,
        });
      } catch (err) {
        console.error(`[Senara CS] ${adapter.siteName} fiyat araması hatası:`, err);
        results.push({
          store: adapter.siteName,
          price: 0,
          shipping: 0,
          url: "",
          available: false,
        });
      }
    }

    console.log("[Senara CS] Fiyat karşılaştırma sonuçları:", results);
    sendResponse(results);
  } catch (err) {
    console.error("[Senara CS] COMPARE_PRICE hatası:", err);
    sendResponse({ error: err.message });
  }
}
