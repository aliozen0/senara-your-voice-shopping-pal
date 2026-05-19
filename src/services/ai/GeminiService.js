import { AIServiceInterface } from "./AIServiceInterface.js";
import { GEMINI_API_KEY } from "../../config/index.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Resmi Google Gemini API implementasyonu (@google/generative-ai).
 *
 * @implements {AIServiceInterface}
 */
export class GeminiService extends AIServiceInterface {
  constructor(apiKey = GEMINI_API_KEY) {
    super();
    this.apiKey = apiKey;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  get model() {
    if (!this.genAI) throw new Error("GEMINI_API_KEY tanımlı değil.");
    // Metin ve analiz işlemleri için hızlı flash modeli
    return this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  /**
   * Kullanıcı cümlesinden arama sorgusu ve filtreleri çıkarır.
   * Lokal parse → API çağrısı yok, hızlı ve kota sorunsuz.
   */
  async parseIntent(userText) {
    return localParseIntent(userText);
  }

  async analyzeImage(imageUrl) {
    const prompt = "Bu ürün görselini incele ve SADECE şu bilgileri içeren kısa, net bir sesli asistan cümlesi kur: renk, desen, üstündeki yazı veya logo, kesim tipi, kol boyu, yaka tipi ve kumaş dokusu. Örnek: 'Siyah pamuklu tişört, kısa kollu, yuvarlak yaka, göğüs üzerinde beyaz logo var.' Ekstra yorum yapma.";

    try {
      // Görseli indirip base64'e çevirmeyi dene (tarayıcı uyumlu)
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Image = btoa(binary);
      
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: response.headers.get("content-type") || "image/jpeg"
          }
        }
      ]);
      return result.response.text();
    } catch (fetchError) {
      console.warn("[Senara AI] Görsel indirilemedi, URL ile deneniyor:", fetchError.message);
      // Fallback: Görseli indiremezse sadece URL'yi ve ürün açıklamasını ver
      try {
        const result = await this.model.generateContent(
          prompt + ` Ürün görseli şu URL'de: ${imageUrl}`
        );
        return result.response.text();
      } catch (error) {
        console.error("[Senara AI] Görsel analizi hatası:", error);
        return "Ürün görselini şu an analiz edemiyorum.";
      }
    }
  }

  async analyzeReviews(reviews) {
    if (!reviews || reviews.length === 0) {
      return {
        positive: ["Yorum bulunamadı"],
        negative: [],
        sensoryDesc: "",
        sizeAdvice: "",
        score: 5,
      };
    }
    const prompt = `Şu ürün yorumlarını analiz et ve JSON döndür:
${reviews.join("\n---\n")}

Sadece JSON döndür, JSON işaretçileri (markdown) kullanma. Başka bir metin yazma.
Format: {
  "positive": ["en çok tekrar eden olumlu yorum"],
  "negative": ["en çok tekrar eden şikayet"],
  "sensoryDesc": "kumaş ve kalite hissi",
  "sizeAdvice": "beden tavsiyesi (örn: kalıpları dar 1 beden büyük alın)",
  "score": 4.5
}`;

    try {
      const result = await this.model.generateContent(prompt);
      let text = result.response.text();
      // Markdown json bloğu varsa temizle
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(extractJson(text));
    } catch (error) {
      console.error("[Senara AI] Yorum analizi hatası:", error);
      return {
        positive: [],
        negative: [],
        sensoryDesc: "",
        sizeAdvice: "",
        score: 5,
      };
    }
  }

  async generateResponse(context, question) {
    const prompt = `Sen Senara adında bir Türkçe sesli alışveriş asistanısın. Kısa, samimi ve doğal konuş. Kullanıcı görme engelli olduğu için doğrudan ve net ol.
Bağlam: ${JSON.stringify(context)}
Soru: ${question}
Kısa, doğal Türkçe cevap ver.`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("[Senara AI] Cevap üretme hatası:", error);
      return "Şu anda size yanıt veremiyorum.";
    }
  }

  async checkFit(productDetails, userProfile) {
    if (!userProfile) return "Beden ölçülerinizi henüz kaydetmemişsiniz. Lütfen boyunuzu ve kilonuzu belirtin.";
    const prompt = `Senara adlı sesli alışveriş asistanısın. Kullanıcı şu kıyafeti almayı düşünüyor: "${productDetails}". 
Kullanıcının ölçüleri: Boy ${userProfile.height} cm, Kilo ${userProfile.weight} kg, Normal Bedeni: ${userProfile.size}.
Kısa, samimi ve net bir beden tavsiyesi ver. Sesli okunacağı için akıcı olsun. Örneğin: "Normalde M giyiyorsunuz ancak bu ürün dar kalıp olduğu için L almanızı öneririm."`;
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("[Senara AI] Fit coach hatası:", error);
      return "Uygunluk analizi yapılamadı.";
    }
  }

  async suggestOutfit(currentProduct, wardrobeItems) {
    if (!wardrobeItems || wardrobeItems.length === 0) {
      return "Dolabınızda henüz kayıtlı kıyafet yok. Önce beğendiğiniz ürünleri 'dolabıma ekle' diyerek kaydedin.";
    }
    const prompt = `Senara adlı sesli alışveriş asistanısın. Kullanıcı şu ürünü inceliyor: "${currentProduct}".
Dolabındaki kıyafetler: ${wardrobeItems}.
Bu ürünle dolaptaki hangi parçaları kombinleyebileceğini kısa ve samimi bir şekilde öner. Sesli okunacağı için akıcı ve doğal bir Türkçe kullan. Maksimum 3 cümle.`;
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("[Senara AI] Kombin önerisi hatası:", error);
      return "Kombin önerisi oluşturulamadı.";
    }
  }

  /**
   * Yeni ürünün dolaptaki kıyafetlerle renk/stil uyumunu analiz eder.
   * selectProduct sırasında otomatik çağrılır.
   */
  async matchWithWardrobe(productName, wardrobeItems) {
    if (!wardrobeItems || wardrobeItems.length === 0) return "";
    const prompt = `Sen Senara adlı akıllı bir moda asistanısın. 
Kullanıcı şu ürünü inceliyor: "${productName}".
Dolabındaki mevcut kıyafetler: ${wardrobeItems}.

Şunları yap:
1. Bu yeni ürünün dolaptaki hangi kıyafetlerle RENK ve STİL açısından uyumlu olduğunu belirt (örn: "Mor ile beyaz harika gider, beyaz tişörtünle mükemmel olur").
2. Dolabında eksik olan bir parça varsa onu öner (örn: "Zaten 2 tane pantolon var, bir etek de ekleyebilirsin").
3. Uyumsuz olacak parçaları nazikçe belirt.

Cevabın KISA ve SAMİMİ olsun (maksimum 3-4 cümle). Sesli okunacağı için doğal Türkçe kullan. Emojisiz yaz.`;
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("[Senara AI] Dolap eşleştirme hatası:", error);
      return "";
    }
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

/* ── Lokal Türkçe intent parser ───────────────────────────── */
const COLORS = [
  "siyah", "beyaz", "kırmızı", "mavi", "yeşil", "sarı",
  "turuncu", "mor", "pembe", "gri", "kahverengi", "lacivert",
  "bej", "bordo", "haki", "krem",
];

const SIZES = [
  "xs", "s", "m", "l", "xl", "xxl", "xxxl",
  "36", "37", "38", "39", "40", "41", "42", "43", "44", "45",
  "küçük beden", "büyük beden",
];

const FILLER_WORDS = [
  "bul", "bulur", "bulabilir", "bulsana",
  "ara", "arar", "arayabilir",
  "bak", "bakar", "bakabilir",
  "ister", "istiyorum", "isterim",
  "misin", "mısın", "musun", "müsün",
  "lütfen", "bir", "tane", "biraz",
  "bana", "benim", "için", "lazım",
  "göster", "gösterir", "ver",
  "merhaba", "selam", "hey",
  "arıyorum", "bakıyorum", "alayım", "alırım",
];

function localParseIntent(userText) {
  const lower = userText.toLowerCase().trim();
  const filters = { color: null, size: null, maxPrice: null };

  const priceMatch = lower.match(/(\d+)\s*(lira|tl|₺)/);
  if (priceMatch) {
    filters.maxPrice = parseInt(priceMatch[1], 10);
  }

  for (const color of COLORS) {
    if (lower.includes(color)) {
      filters.color = color;
      break;
    }
  }

  for (const size of SIZES) {
    const re = new RegExp(`\\b${size}\\b`, "i");
    if (re.test(lower)) {
      filters.size = size.toUpperCase();
      break;
    }
  }

  let query = lower;
  query = query.replace(/(\d+)\s*(lira|tl|₺)(dan|den)?\s*(ucuz|altı|altında)?/gi, "");
  if (filters.color) query = query.replace(new RegExp(filters.color, "gi"), "");
  if (filters.size) {
    query = query.replace(new RegExp(`\\b${filters.size}\\b`, "gi"), "");
    query = query.replace(/\bbeden\b/gi, "");
  }
  for (const filler of FILLER_WORDS) {
    query = query.replace(new RegExp(`\\b${filler}\\b`, "gi"), "");
  }
  query = query.replace(/[?.!,]/g, "").replace(/\s+/g, " ").trim();

  query = query.split(" ").map(turkishStem).join(" ").trim();
  if (!query) query = userText.trim();
  return { query, filters };
}

function turkishStem(word) {
  if (word.length < 4) return word;
  const suffixes = [
    "ları", "leri", "ını", "ini", "unu", "ünü",
    "nın", "nin", "nun", "nün",
    "dan", "den", "tan", "ten",
    "da", "de", "ta", "te",
    "na", "ne", "ya", "ye",
    "nı", "ni", "nu", "nü",
    "ı", "i", "u", "ü",
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}
