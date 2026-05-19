/**
 * Dolap Hafızası Servisi
 * Kullanıcının beğendiği kıyafetleri localStorage'a kaydeder,
 * listeyi sesli okur ve Gemini ile kombin önerir.
 */
const STORAGE_KEY = "senara_wardrobe";
const SEEDED_KEY = "senara_wardrobe_seeded";

/**
 * Demo karakter: Merve'nin dolabı.
 * İlk kullanımda otomatik olarak yüklenir.
 */
const DEMO_WARDROBE = [
  {
    id: "demo-1",
    name: "Siyah Yüksek Bel Skinny Jean Pantolon",
    price: 349,
    currency: "TL",
    imageUrl: "",
    category: "alt",
    color: "siyah",
  },
  {
    id: "demo-2",
    name: "Beyaz Basic Oversize Pamuklu Tişört",
    price: 199,
    currency: "TL",
    imageUrl: "",
    category: "üst",
    color: "beyaz",
  },
  {
    id: "demo-3",
    name: "Lacivert Blazer Ceket Slim Fit",
    price: 899,
    currency: "TL",
    imageUrl: "",
    category: "üst",
    color: "lacivert",
  },
  {
    id: "demo-4",
    name: "Bej Keten Palazzo Pantolon",
    price: 459,
    currency: "TL",
    imageUrl: "",
    category: "alt",
    color: "bej",
  },
  {
    id: "demo-5",
    name: "Kırmızı V Yaka Triko Kazak",
    price: 329,
    currency: "TL",
    imageUrl: "",
    category: "üst",
    color: "kırmızı",
  },
  {
    id: "demo-6",
    name: "Siyah Deri Bağcıklı Sneaker Ayakkabı",
    price: 699,
    currency: "TL",
    imageUrl: "",
    category: "ayakkabı",
    color: "siyah",
  },
  {
    id: "demo-7",
    name: "Kahverengi Deri Omuz Çantası",
    price: 549,
    currency: "TL",
    imageUrl: "",
    category: "aksesuar",
    color: "kahverengi",
  },
];

export class WardrobeService {
  /**
   * İlk kullanımda demo dolabı yükler.
   */
  static ensureSeeded() {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SEEDED_KEY)) return; // Zaten yüklendi
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_WARDROBE));
    localStorage.setItem(SEEDED_KEY, "true");
  }

  /**
   * Dolaptaki tüm kıyafetleri getirir.
   * @returns {Array} Kayıtlı ürün listesi
   */
  static getAll() {
    if (typeof window === "undefined") return [];
    WardrobeService.ensureSeeded();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  /**
   * Ürünü dolaba ekler (aynı ürünü tekrar eklemez).
   * @param {Object} product - Eklenecek ürün
   * @returns {boolean} Eklendi mi?
   */
  static add(product) {
    if (!product) return false;
    const items = WardrobeService.getAll();
    // Aynı isimle tekrar eklenmesini engelle
    if (items.some((i) => i.name === product.name)) return false;
    items.push({
      id: product.id || `w-${Date.now()}`,
      name: product.name,
      price: product.price,
      currency: product.currency || "TL",
      imageUrl: product.imageUrl || "",
      productUrl: product.productUrl || "",
      storeName: product.storeName || "Trendyol",
      addedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  }

  /**
   * Ürünü dolaptan siler.
   * @param {string} productId
   */
  static remove(productId) {
    const items = WardrobeService.getAll().filter((i) => i.id !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /**
   * Dolabı tamamen temizler.
   */
  static clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Dolaptaki kıyafetlerin sesli okunacak özetini oluşturur.
   * @returns {string} Sesli asistan metni
   */
  static buildWardrobeSummary() {
    const items = WardrobeService.getAll();
    if (items.length === 0) {
      return "Dolabınız şu an boş. Bir ürün beğendiğinizde 'dolabıma ekle' diyerek kaydedebilirsiniz.";
    }
    let text = `Dolabınızda ${items.length} kıyafet var. `;
    items.forEach((item, i) => {
      text += `${i + 1}. ${item.name}, ${item.price} ${item.currency}. `;
    });
    text += "Kombin önerisi için 'buna ne giyebilirim' diyebilirsiniz.";
    return text;
  }

  /**
   * Gemini'ye gönderilecek dolap açıklamasını oluşturur.
   * @returns {string}
   */
  static buildWardrobeContext() {
    const items = WardrobeService.getAll();
    if (items.length === 0) return "";
    return items.map((i) => i.name).join(", ");
  }
}
