import { SearchServiceInterface } from "./SearchServiceInterface.js";

/**
 * Chrome Extension content script ile haberleşen gerçek arama servisi.
 * Şu an iskelet implementasyon — chrome.runtime mevcutsa kullanır.
 * @implements {SearchServiceInterface}
 */
export class ExtensionSearchService extends SearchServiceInterface {
  async searchProducts(query, filters) {
    return this._send({ type: "SEARCH_PRODUCTS", query, filters });
  }
  async getProductDetail(url) {
    return this._send({ type: "GET_PRODUCT_DETAIL", url });
  }
  async comparePrice(productName) {
    return this._send({ type: "COMPARE_PRICE", productName });
  }

  _send(message) {
    return new Promise((resolve, reject) => {
      const chromeRuntime =
        typeof chrome !== "undefined" ? chrome?.runtime : undefined;
      if (!chromeRuntime?.sendMessage) {
        reject(new Error("Chrome extension runtime bulunamadı"));
        return;
      }
      chromeRuntime.sendMessage(message, (response) => {
        if (chromeRuntime.lastError) {
          reject(new Error(chromeRuntime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }
}
