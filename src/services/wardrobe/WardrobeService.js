/**
 * Dolap Hafızası Servisi
 * Kullanıcının beğendiği kıyafetleri localStorage'a kaydeder,
 * listeyi sesli okur ve Gemini ile kombin önerir.
 */
const STORAGE_KEY = "senara_wardrobe";

export class WardrobeService {
  /**
   * Dolaptaki tüm kıyafetleri getirir.
   * @returns {Array} Kayıtlı ürün listesi
   */
  static getAll() {
    if (typeof window === "undefined") return [];
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
