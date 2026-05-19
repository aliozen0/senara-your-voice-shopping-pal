import { AIServiceInterface } from "./AIServiceInterface.js";
import { IO_API_KEY } from "../../config/index.js";

/**
 * io.net Intelligence API implementasyonu.
 * OpenAI-uyumlu chat completions endpoint kullanır.
 *
 * ── AGENTİK MİMARİ ──
 * - parseIntent: Kullanıcı cümlesinden arama sorgusu ve filtreler çıkarır (lokal)
 * - analyzeImage: Ürün görseli açıklaması (AI)
 * - analyzeReviews: Yorum analizi (AI)
 * - generateResponse: Genel konuşma (AI)
 *
 * @implements {AIServiceInterface}
 */
export class GeminiService extends AIServiceInterface {
  constructor(apiKey = IO_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = "https://api.intelligence.io.net/api/v1";
    this.model = "meta-llama/Llama-3.3-70B-Instruct";
  }

  /**
   * Kullanıcı cümlesinden arama sorgusu ve filtreleri çıkarır.
   * Lokal parse → API çağrısı yok, hızlı ve kota sorunsuz.
   */
  async parseIntent(userText) {
    return localParseIntent(userText);
  }

  async analyzeImage(imageUrl) {
    return this._chat(
      "Sen görme engelli kullanıcılara yardım eden bir ürün açıklama asistanısın.",
      `Bu ürün görselini kısa ve net Türkçe anlat (3-4 cümle): ${imageUrl}`,
    );
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

Sadece JSON döndür, başka bir şey yazma.
Format: {"positive": string[], "negative": string[], "sensoryDesc": string, "sizeAdvice": string, "score": number}`;

    const text = await this._chat(
      "Sen bir e-ticaret yorum analiz asistanısın. Sadece JSON döndür.",
      prompt,
    );
    try {
      return JSON.parse(extractJson(text));
    } catch {
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
    return this._chat(
      "Sen Senara adında bir Türkçe sesli alışveriş asistanısın. Kısa ve doğal konuş.",
      `Bağlam: ${JSON.stringify(context)}\nSoru: ${question}\nKısa, doğal Türkçe cevap ver.`,
    );
  }

  /**
   * io.net OpenAI-uyumlu chat completions endpoint.
   */
  async _chat(systemPrompt, userMessage) {
    if (!this.apiKey) throw new Error("IO_API_KEY tanımlı değil");

    const url = `${this.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[Senara AI] io.net API hatası ${res.status}:`, errorText);
      throw new Error(`AI API hatası: ${res.status}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
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

/**
 * Kullanıcı cümlesinden arama sorgusu ve filtreleri çıkarır.
 * Gemini/io.net API çağrısı yapmadan, lokal regex ile çalışır.
 *
 * Örnekler:
 *   "200 liradan ucuz eşofman" → { query: "eşofman", filters: { maxPrice: 200 } }
 *   "siyah M beden tişört bul" → { query: "tişört", filters: { color: "siyah", size: "M" } }
 *   "eşofman arar mısın"      → { query: "eşofman", filters: {} }
 */
function localParseIntent(userText) {
  const lower = userText.toLowerCase().trim();
  const filters = { color: null, size: null, maxPrice: null };

  // Fiyat çıkar
  const priceMatch = lower.match(/(\d+)\s*(lira|tl|₺)/);
  if (priceMatch) {
    filters.maxPrice = parseInt(priceMatch[1], 10);
  }

  // Renk çıkar
  for (const color of COLORS) {
    if (lower.includes(color)) {
      filters.color = color;
      break;
    }
  }

  // Beden çıkar
  for (const size of SIZES) {
    const re = new RegExp(`\\b${size}\\b`, "i");
    if (re.test(lower)) {
      filters.size = size.toUpperCase();
      break;
    }
  }

  // Sorguyu temizle
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

  // Türkçe ek kaldırma (basit stemming)
  // "eşofmanı" → "eşofman", "tişörtü" → "tişört", "pantolonu" → "pantolon"
  query = query.split(" ").map(turkishStem).join(" ").trim();

  if (!query) query = userText.trim();

  return { query, filters };
}

/**
 * Basit Türkçe kök bulma — arama sorgusundaki ekleri kaldırır.
 * Tam morfolojik analiz değil, yaygın isim hallerini temizler.
 */
function turkishStem(word) {
  if (word.length < 4) return word;

  // Sıralama önemli: uzun ekler önce kontrol edilmeli
  const suffixes = [
    // Hal ekleri (accusative, dative, locative, ablative)
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
