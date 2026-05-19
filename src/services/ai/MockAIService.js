import { AIServiceInterface } from "./AIServiceInterface.js";

/**
 * Gerçekçi mock AI servisi. API key gerektirmez.
 * @implements {AIServiceInterface}
 */
export class MockAIService extends AIServiceInterface {
  async parseIntent(userText) {
    const text = (userText || "").toLowerCase();
    const colorMatch = text.match(
      /\b(siyah|beyaz|mavi|kırmızı|yeşil|gri|kahverengi|sarı|pembe|mor)\b/,
    );
    const sizeMatch = text.match(/\b(xs|s|m|l|xl|xxl)\b/i);
    const priceMatch = text.match(/(\d+)\s*(tl|lira)/);

    // Basit kategori çıkarımı
    const cleaned = text
      .replace(/(arıyorum|istiyorum|bul|göster|lütfen)/g, "")
      .trim();

    return {
      query: cleaned || text,
      filters: {
        color: colorMatch?.[1] ?? null,
        size: sizeMatch?.[1]?.toUpperCase() ?? null,
        maxPrice: priceMatch ? Number(priceMatch[1]) : null,
      },
    };
  }

  async analyzeImage(_imageUrl) {
    await delay(400);
    return "Düz siyah tişört. Yuvarlak yaka kesim. Hafif ince görünümlü kumaş. Göğüs bölgesinde küçük marka logosu var. Rahat kalıp.";
  }

  async analyzeReviews(_reviews) {
    await delay(500);
    return {
      positive: ["Kumaş kaliteli", "Renk solmuyor", "Tam kalıp"],
      negative: ["Küçük kaçıyor", "Yıkamada şekil bozuluyor"],
      sensoryDesc:
        "Pamuklu, nefes alan bir kumaş. Yazlık kullanım için uygun.",
      sizeAdvice: "Bir beden büyük almanızı öneririm.",
      score: 8,
    };
  }

  async generateResponse(_context, question) {
    await delay(300);
    return `Sorduğunuz "${question}" için elimde net bir bilgi yok, ürün detaylarına bakmamı ister misiniz?`;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
