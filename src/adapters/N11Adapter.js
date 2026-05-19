import { AdapterInterface } from "./AdapterInterface.js";

export class N11Adapter extends AdapterInterface {
  get siteName() { return "n11"; }
  get urlPattern() { return /n11\.com/i; }
  extractProduct(_dom) { return { id: "", name: "", price: 0, imageUrl: "", store: "n11", rating: 0, url: "", images: [] }; }
  extractReviews(_dom) { return []; }
  extractPrice(_dom) { return 0; }
  buildSearchUrl(query) {
    return `https://www.n11.com/arama?q=${encodeURIComponent(query)}`;
  }
}
