import { SearchServiceInterface } from "./SearchServiceInterface.js";

const MOCK_PRODUCTS = [
  {
    id: "p1",
    name: "Siyah Basic Erkek Tişört",
    price: 149,
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
    store: "trendyol",
    rating: 4.5,
    url: "https://www.trendyol.com/p/1",
    images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"],
    reviewCount: 342,
  },
  {
    id: "p2",
    name: "Oversize Siyah Tişört",
    price: 189,
    imageUrl: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400",
    store: "hepsiburada",
    rating: 4.2,
    url: "https://www.hepsiburada.com/p/2",
    images: ["https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400"],
    reviewCount: 188,
  },
  {
    id: "p3",
    name: "%100 Pamuk Siyah Tişört",
    price: 129,
    imageUrl: "https://images.unsplash.com/photo-1622445275576-721325763afe?w=400",
    store: "n11",
    rating: 4.7,
    url: "https://www.n11.com/p/3",
    images: ["https://images.unsplash.com/photo-1622445275576-721325763afe?w=400"],
    reviewCount: 521,
  },
  {
    id: "p4",
    name: "Premium Siyah Tişört",
    price: 219,
    imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    store: "trendyol",
    rating: 4.8,
    url: "https://www.trendyol.com/p/4",
    images: ["https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400"],
    reviewCount: 904,
  },
];

const MOCK_REVIEWS = [
  "Kumaşı çok kaliteli, tam kalıp.",
  "Bir beden küçük geldi, büyük alın.",
  "Renk solmuyor, çok memnunum.",
  "Yıkamada hafif şekil bozulması oldu.",
];

/**
 * @implements {SearchServiceInterface}
 */
export class MockSearchService extends SearchServiceInterface {
  async searchProducts(_query, filters = {}) {
    await delay(600);
    let list = [...MOCK_PRODUCTS];
    if (filters.maxPrice) list = list.filter((p) => p.price <= filters.maxPrice);
    return list;
  }

  async getProductDetail(url) {
    await delay(300);
    return MOCK_PRODUCTS.find((p) => p.url === url) ?? MOCK_PRODUCTS[0];
  }

  async comparePrice(_productName) {
    await delay(500);
    return [
      { store: "Trendyol", price: 149, shipping: 29, url: "https://trendyol.com", inStock: true },
      { store: "Hepsiburada", price: 165, shipping: 0, url: "https://hepsiburada.com", inStock: true },
      { store: "N11", price: 139, shipping: 19, url: "https://n11.com", inStock: true },
    ];
  }

  static getMockReviews() {
    return MOCK_REVIEWS;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
