import { SearchServiceInterface } from "./SearchServiceInterface.js";
import { scrapeTrendyol } from "./playwrightServer.ts";

/**
 * Backend'deki Playwright server fonksiyonunu çağıran servis.
 *
 * @implements {SearchServiceInterface}
 */
export class PlaywrightSearchService extends SearchServiceInterface {
  async searchProducts(query, filters = {}) {
    try {
      let searchQuery = query;
      // Renk zaten sorguda yoksa ekle (tekrarı engelle)
      if (filters.color && !searchQuery.toLowerCase().includes(filters.color.toLowerCase())) {
        searchQuery = `${filters.color} ${searchQuery}`;
      }
      if (filters.size) searchQuery = `${searchQuery} ${filters.size} beden`;

      // TanStack Start RPC (server function) çağrısı
      const products = await scrapeTrendyol({ data: searchQuery });
      
      // Filtreleme
      return products.filter((p) => {
        if (filters.maxPrice && p.price > filters.maxPrice) return false;
        return true;
      });
      
    } catch (error) {
      console.error("[PlaywrightSearchService] Hata:", error);
      return [];
    }
  }

  async getProductDetail(productId) {
    return {
      id: productId,
      description: "Ürün detayları (mock).",
      reviews: [
        "Kumaşı çok güzel, beğendim.",
        "Rengi fotoğraftakinden biraz farklı ama kaliteli.",
        "Bir beden büyük alınmalı bence."
      ]
    };
  }

  async comparePrice(product) {
    try {
      // Ürün adından kısa bir arama terimi oluştur (ilk 3-4 kelime)
      const searchTerms = (typeof product === "string" ? product : product.name || "")
        .split(" ")
        .slice(0, 4)
        .join(" ");

      if (!searchTerms) {
        return [{ store: "Trendyol", price: 0, shipping: 0, name: "Bilinmeyen ürün" }];
      }

      // Trendyol'da benzer ürünleri ara (en ucuz sıralama)
      const results = await scrapeTrendyol({ data: searchTerms });

      if (!results || results.length === 0) {
        return [{ store: "Trendyol", price: 0, shipping: 0, name: "Sonuç bulunamadı" }];
      }

      // İlk 4 farklı satıcıyı/ürünü karşılaştırma listesine ekle
      return results.slice(0, 4).map((r) => ({
        store: r.storeName || "Trendyol",
        price: r.price,
        shipping: 0, // Trendyol çoğu ürünü kargo bedava gösteriyor
        name: r.name,
        productUrl: r.productUrl,
      }));
    } catch (error) {
      console.error("[PlaywrightSearchService] Fiyat karşılaştırma hatası:", error);
      return [{ store: "Trendyol", price: 0, shipping: 0, name: "Karşılaştırma yapılamadı" }];
    }
  }
}
