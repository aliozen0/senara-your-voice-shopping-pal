import { AdapterInterface } from "./AdapterInterface.js";

export class TrendyolAdapter extends AdapterInterface {
  get siteName() { return "trendyol"; }
  get urlPattern() { return /trendyol\.com/i; }

  extractProduct(_dom) {
    return { id: "", name: "", price: 0, imageUrl: "", store: "trendyol", rating: 0, url: "", images: [] };
  }
  extractReviews(_dom) { return []; }
  extractPrice(_dom) { return 0; }

  buildSearchUrl(query, filters = {}) {
    const params = new URLSearchParams({ q: query });
    if (filters.maxPrice) params.set("prc", `0-${filters.maxPrice}`);
    return `https://www.trendyol.com/sr?${params.toString()}`;
  }
}
