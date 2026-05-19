import { AIServiceInterface } from "./AIServiceInterface.js";
import { GEMINI_API_KEY } from "../../config/index.js";

/**
 * Gerçek Gemini API implementasyonu.
 * NOT: Bu iskelet implementasyondur; ağ çağrıları üretim için
 * server tarafında bir proxy üzerinden yapılmalıdır.
 * @implements {AIServiceInterface}
 */
export class GeminiService extends AIServiceInterface {
  constructor(apiKey = GEMINI_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.model = "gemini-1.5-flash";
  }

  async parseIntent(userText) {
    const prompt = `Kullanıcı bir e-ticaret aramasında şunu söyledi: "${userText}".
JSON döndür: {"query": string, "filters": {"color": string|null, "size": string|null, "maxPrice": number|null}}`;
    const text = await this._generate(prompt);
    try {
      return JSON.parse(extractJson(text));
    } catch {
      return { query: userText, filters: { color: null, size: null, maxPrice: null } };
    }
  }

  async analyzeImage(imageUrl) {
    return this._generate(
      `Bu ürün görselini görme engelli bir kullanıcıya kısa ve net Türkçe anlat: ${imageUrl}`,
    );
  }

  async analyzeReviews(reviews) {
    const prompt = `Şu ürün yorumlarını analiz et ve JSON döndür:
${reviews.join("\n---\n")}

Format: {"positive": string[], "negative": string[], "sensoryDesc": string, "sizeAdvice": string, "score": number}`;
    const text = await this._generate(prompt);
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
    return this._generate(
      `Bağlam: ${JSON.stringify(context)}\nSoru: ${question}\nKısa, doğal Türkçe cevap ver.`,
    );
  }

  async _generate(prompt) {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY tanımlı değil");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) throw new Error(`Gemini API hatası: ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}
