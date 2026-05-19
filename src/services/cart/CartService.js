/**
 * Alışveriş Sepeti Servisi
 * Kullanıcının sepetine eklediği ürünleri localStorage'a kaydeder,
 * sepeti yönetir ve sesli asistan için sepet özetini oluşturur.
 */
const STORAGE_KEY = "senara_cart";

export class CartService {
  /**
   * Sepetteki tüm ürünleri getirir.
   * @returns {Array} Kayıtlı sepet ürün listesi
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
   * Ürünü sepete ekler (aynı ürün sepette varsa miktarını artırabilir veya eklemez).
   * @param {Object} product - Eklenecek ürün
   * @returns {boolean} Eklendi mi?
   */
  static add(product) {
    if (!product) return false;
    const items = CartService.getAll();
    
    // Aynı isimle tekrar eklenmesini engelle (veya adet artır)
    if (items.some((i) => i.name === product.name)) return false;
    
    items.push({
      id: product.id || `c-${Date.now()}`,
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
   * Ürünü sepetten siler.
   * @param {string} productId
   */
  static remove(productId) {
    const items = CartService.getAll().filter((i) => i.id !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /**
   * Sepeti tamamen temizler.
   */
  static clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Sepetteki ürünlerin sesli okunacak özetini oluşturur.
   * @returns {string} Sesli asistan metni
   */
  static buildCartSummary() {
    const items = CartService.getAll();
    if (items.length === 0) {
      return "Alışveriş listeniz şu an boş. Bir ürünün detayındayken 'listeye ekle' veya 'alışveriş listeme ekle' diyerek listenize ekleyebilirsiniz.";
    }
    
    const totalPrice = items.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    
    let text = `Alışveriş listenizde ${items.length} ürün var. `;
    items.forEach((item, i) => {
      text += `${i + 1}. ${item.name}, ${item.price} ${item.currency}. `;
    });
    text += `Toplam tutar ${totalPrice} TL. Siparişi tamamlamak için 'sipariş ver' veya 'satın al' diyebilirsiniz.`;
    return text;
  }
}
