/**
 * @fileoverview Senara Chrome Extension — Hepsiburada Content Script
 *
 * Hepsiburada.com üzerinde çalışır. injector.js'in yüklediği
 * adapter mantığını kullanır.
 *
 * SPA navigasyonlarını MutationObserver ile tespit eder
 * ve background'a URL değişikliklerini bildirir.
 *
 * @module content_scripts/hepsiburada
 */

(function () {
  "use strict";

  console.log("[Senara CS - Hepsiburada] Site-specific script yüklendi.");

  let lastUrl = window.location.href;

  /**
   * URL değişimlerini izler.
   * Hepsiburada bazı sayfalarda SPA navigasyonu kullanır.
   */
  function watchUrlChanges() {
    window.addEventListener("popstate", () => {
      onUrlChanged();
    });

    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        onUrlChanged();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

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
    console.log("[Senara CS - Hepsiburada] URL değişti:", newUrl);

    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "URL_CHANGED",
        url: newUrl,
        site: "hepsiburada",
      }).catch(() => {
        // Extension context invalidated olabilir
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchUrlChanges);
  } else {
    watchUrlChanges();
  }
})();
