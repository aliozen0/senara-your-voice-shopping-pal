/**
 * @fileoverview Senara Chrome Extension — Trendyol Content Script
 *
 * Trendyol.com üzerinde çalışır. injector.js'in yüklediği
 * adapter mantığını kullanır.
 *
 * SPA (React/Next router) navigasyonlarını MutationObserver
 * ile tespit eder ve background'a URL değişikliklerini bildirir.
 *
 * @module content_scripts/trendyol
 */

(function () {
  "use strict";

  console.log("[Senara CS - Trendyol] Site-specific script yüklendi.");

  let lastUrl = window.location.href;

  /**
   * URL değişimlerini izler.
   * Trendyol SPA navigasyonu kullanır, bu yüzden
   * MutationObserver + popstate ile URL değişimini yakalıyoruz.
   */
  function watchUrlChanges() {
    // popstate olayı (geri/ileri butonları)
    window.addEventListener("popstate", () => {
      onUrlChanged();
    });

    // SPA navigasyonları için MutationObserver
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        onUrlChanged();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // history.pushState / replaceState override
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      onUrlChanged();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      onUrlChanged();
    };
  }

  /**
   * URL değiştiğinde background'a bilgi gönderir.
   */
  function onUrlChanged() {
    const newUrl = window.location.href;
    if (newUrl === lastUrl) return;

    lastUrl = newUrl;
    console.log("[Senara CS - Trendyol] URL değişti:", newUrl);

    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "URL_CHANGED",
        url: newUrl,
        site: "trendyol",
      }).catch(() => {
        // Extension context invalidated olabilir
      });
    }
  }

  // Başlat
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchUrlChanges);
  } else {
    watchUrlChanges();
  }
})();
