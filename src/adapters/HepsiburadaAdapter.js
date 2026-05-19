import { AdapterInterface } from "./AdapterInterface.js";

export class HepsiburadaAdapter extends AdapterInterface {
  get siteName() { return "hepsiburada"; }
  get urlPattern() { return /hepsiburada\.com/i; }
  extractProduct(_dom) { return { id: "", name: "", price: 0, imageUrl: "", store: "hepsiburada", rating: 0, url: "", images: [] }; }
  extractReviews(_dom) { return []; }
  extractPrice(_dom) { return 0; }
  buildSearchUrl(query) {
    return `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
  }
}
