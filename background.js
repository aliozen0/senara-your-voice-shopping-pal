/**
 * @fileoverview Senara Chrome Extension — Background Service Worker
 *
 * Bu dosya extension'ın arka plan service worker'ıdır.
 * Görevleri:
 *   1. Extension ikonu tıklandığında side panel'i açar.
 *   2. Tab URL'i değiştiğinde side panel'e bilgi gönderir.
 *   3. Side panel'den gelen mesajları content script'e iletir.
 *   4. Content script'ten gelen cevapları side panel'e döndürür.
 *
 * @module background
 */

/* ─── 1. İkon tıklanınca side panel aç ──────────────────────── */
chrome.action.onClicked.addListener((tab) => {
  console.log("[Senara BG] İkon tıklandı, side panel açılıyor. Tab:", tab.id);
  chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
    console.error("[Senara BG] Side panel açılamadı:", err);
  });
});

/* ─── 2. Tab güncellendiğinde side panel'e bildir ───────────── */

/**
 * Desteklenen sitelerin URL pattern'leri.
 * Bir tab bu sitelerden birine girdiğinde side panel bilgilendirilir.
 */
const SUPPORTED_PATTERNS = [
  { name: "trendyol",    pattern: /trendyol\.com/i },
  { name: "hepsiburada", pattern: /hepsiburada\.com/i },
  { name: "n11",         pattern: /n11\.com/i },
  { name: "amazon",      pattern: /amazon\.com\.tr/i },
];

/**
 * Verilen URL için aktif adapter adını döndürür.
 * @param {string} url
 * @returns {string|null}
 */
function detectAdapter(url) {
  if (!url) return null;
  for (const site of SUPPORTED_PATTERNS) {
    if (site.pattern.test(url)) return site.name;
  }
  return null;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Sadece URL değiştiğinde tepki ver
  if (changeInfo.url) {
    const adapter = detectAdapter(changeInfo.url);
    console.log("[Senara BG] Tab güncellendi:", tabId, "URL:", changeInfo.url, "Adapter:", adapter);

    // Side panel'e mesaj gönder (side panel açık değilse hata yutulur)
    chrome.runtime.sendMessage({
      type: "TAB_UPDATED",
      url: changeInfo.url,
      tabId: tabId,
      adapter: adapter,
    }).catch(() => {
      // Side panel henüz açılmamış olabilir, sessizce yut
    });
  }
});

/* ─── 3. Side panel → Content script mesaj iletimi ──────────── */

/**
 * Side panel'den gelen mesajları ilgili tab'ın content script'ine
 * iletir. Desteklenen mesaj tipleri:
 *   - SEARCH_PRODUCTS
 *   - GET_PRODUCT_DETAIL
 *   - COMPARE_PRICE
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const forwardTypes = ["SEARCH_PRODUCTS", "GET_PRODUCT_DETAIL", "COMPARE_PRICE"];

  if (!forwardTypes.includes(message.type)) {
    // Bu mesaj background'a ait değil, yoksay
    return false;
  }

  console.log("[Senara BG] Mesaj alındı, content script'e iletiliyor:", message.type);

  // Aktif tab'ı bul ve mesajı ilet
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.warn("[Senara BG] Aktif tab bulunamadı");
      sendResponse({ error: "Aktif tab bulunamadı" });
      return;
    }

    const activeTab = tabs[0];
    console.log("[Senara BG] Content script'e iletiliyor. Tab:", activeTab.id);

    chrome.tabs.sendMessage(activeTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Senara BG] Content script'ten hata:", chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      console.log("[Senara BG] Content script'ten cevap geldi:", response?.type || "veri");
      sendResponse(response);
    });
  });

  // Asenkron sendResponse kullanacağımızı belirt
  return true;
});
