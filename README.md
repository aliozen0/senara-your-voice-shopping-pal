# Senara — Görme Engelliler için Sesli E-Ticaret Asistanı

> **Senara**, görme engelli kullanıcıların **yalnızca konuşarak** alışveriş yapabilmesi için tasarlanmış bir sesli asistan uygulamasıdır. Kullanıcı ekrana bakmaz, dokunmaz. Sistem ürünleri bulur, görselleri analiz eder, yorumları özetler, fiyatları karşılaştırır ve siparişi tamamlar.
>
> Şu anki sürüm, **Chrome Extension Side Panel** mimarisine birebir uyacak şekilde yazılmış bir **React web uygulamasıdır**. Mock servislerle uçtan uca çalışır; tek satır kod değiştirmeden gerçek Gemini API'ye ve gerçek site adapterlerine geçilebilir.

---

## İçindekiler

1. [Vizyon ve Hedef Kullanıcı](#1-vizyon-ve-hedef-kullanıcı)
2. [Özellikler](#2-özellikler)
3. [Teknoloji Yığını](#3-teknoloji-yığını)
4. [Mimari Felsefe (SOLID)](#4-mimari-felsefe-solid)
5. [Klasör Yapısı — Dosya Dosya Açıklama](#5-klasör-yapısı--dosya-dosya-açıklama)
6. [Veri Akışı ve Phase Diyagramı](#6-veri-akışı-ve-phase-diyagramı)
7. [Konuşma Senaryosu (Uçtan Uca)](#7-konuşma-senaryosu-uçtan-uca)
8. [Genişletme Rehberi](#8-genişletme-rehberi)
9. [Kurulum ve Çalıştırma](#9-kurulum-ve-çalıştırma)
10. [Environment Değişkenleri](#10-environment-değişkenleri)
11. [Erişilebilirlik Detayları](#11-erişilebilirlik-detayları)
12. [Tasarım Sistemi](#12-tasarım-sistemi)
13. [Chrome Extension'a Taşıma Yol Haritası](#13-chrome-extensiona-taşıma-yol-haritası)
14. [Bilinen Sınırlamalar](#14-bilinen-sınırlamalar)

---

## 1. Vizyon ve Hedef Kullanıcı

Klasik e-ticaret siteleri görme engelli kullanıcılar için zorludur: küçük yazılar, kalabalık DOM, görsele bağımlı ürün anlatımları, ekran okuyucu için anlamsız "ürün-1234" linkleri… Senara bu deneyimi tersine çevirir:

- Kullanıcı **sesle** konuşur ("siyah L beden tişört arıyorum").
- Sistem ürünü bulur, **görseli AI ile sesli tanımlar** ("düz siyah tişört, yuvarlak yaka, hafif ince kumaş…").
- Yorumları **özetler** (olumlu/olumsuz/kumaş hissi/beden tavsiyesi).
- Birden fazla mağazada **fiyat karşılaştırması** yapar.
- Onay alır ve **siparişi başlatır**.

Kullanıcı tek satır metin yazmak ya da fareyle bir şeye tıklamak zorunda değildir.

---

## 2. Özellikler

| Özellik | Açıklama |
| --- | --- |
| 🎙️ Sesli komut | Web Speech API (Türkçe — `tr-TR`) ile mikrofon dinleme |
| 🔊 Sesli yanıt | SpeechSynthesis ile her cevap sesli okunur |
| 🧠 Niyet ayrıştırma | "Siyah L beden tişört" → `{query, color, size, maxPrice}` |
| 🖼️ Görsel anlatımı | Gemini Vision (mock'ta gerçekçi sahte metin) |
| 📝 Yorum analizi | Olumlu/olumsuz, duyusal, beden tavsiyesi, 1-10 skor |
| 💰 Fiyat karşılaştırma | Trendyol / Hepsiburada / N11 (mock) |
| 🛒 Sipariş yönlendirme | Mağaza linkine yönlendirir |
| 🗂️ Konuşma geçmişi | localStorage'da saklanır, yeniden yüklemede korunur |
| ⌨️ Klavye kısayolu | `Space` / `Enter` ile mikrofonu aç/kapat |
| ♿ Erişilebilirlik | ARIA, focus-visible, 44px+ tap target, koyu+yüksek kontrast tema |
| 🧪 Mock mod | API key olmadan tüm akış test edilebilir |

---

## 3. Teknoloji Yığını

- **TanStack Start v1** + **React 19** — SSR destekli routing
- **Vite 7** — bundler
- **Tailwind CSS v4** — `src/styles.css` üzerinden tema token'ları
- **Web Speech API** — tarayıcı içi STT + TTS
- **Gemini API** (opsiyonel) — gerçek AI servisi
- **JavaScript (JSDoc)** — `services/`, `hooks/`, `adapters/`, `components/` katmanları `.js` / `.jsx`; route ve config dosyaları `.tsx`

> TypeScript projesi içinde `.js`/`.jsx` dosyalarına `tsconfig.json`'da `allowJs: true` ile izin verildi. Tip güvenliği JSDoc `@typedef` bloklarıyla sağlanır.

---

## 4. Mimari Felsefe (SOLID)

Senara **tek bir kuralla** yazıldı: *"Yeni bir site veya AI servisi eklemek için mevcut hiçbir dosyaya dokunulmamalı."*

### 4.1 Single Responsibility
Her class / hook / component tek bir iş yapar:
- `WebSpeechService` → sadece ses
- `MockAIService` → sadece AI cevapları
- `useVoiceAssistant` → sadece phase orkestrasyonu
- `ProductCard` → sadece tek ürünün gösterimi

### 4.2 Open/Closed
- Yeni e-ticaret sitesi → `src/adapters/YeniSiteAdapter.js` ekle, başka dosyaya **dokunma**.
- Yeni AI servisi → `src/services/ai/YeniAIServisi.js` ekle, `ServiceFactory.js`'e bir satır ekle.

### 4.3 Dependency Inversion
Component'ler **interface**'lere bağımlı, implementasyona değil. Hangi servis dönecek kararını **sadece** `ServiceFactory.js` verir. Hiçbir component "ben Gemini kullanıyorum" diye bilmez.

```
Component → Hook → ServiceFactory → Interface → (Mock | Real)
```

### 4.4 Bağımlılık Kuralları
| Katman | Ne yapabilir | Ne yapamaz |
| --- | --- | --- |
| `components/` | Hook çağırır | Doğrudan API çağırmaz |
| `hooks/` | Service'leri Factory'den alır | Site-spesifik DOM bilmez |
| `services/` | API & tarayıcı API'leri | UI bilmez |
| `adapters/` | Site-spesifik DOM parse | UI bilmez, başka adapter bilmez |
| `config/` | Sabitler & env okuma | Çağrı yapmaz |

---

## 5. Klasör Yapısı — Dosya Dosya Açıklama

```
src/
├── config/
│   └── index.js
├── types/
│   └── index.js
├── services/
│   ├── ai/
│   │   ├── AIServiceInterface.js
│   │   ├── GeminiService.js
│   │   └── MockAIService.js
│   ├── speech/
│   │   ├── SpeechServiceInterface.js
│   │   └── WebSpeechService.js
│   ├── search/
│   │   ├── SearchServiceInterface.js
│   │   ├── MockSearchService.js
│   │   └── ExtensionSearchService.js
│   └── ServiceFactory.js
├── adapters/
│   ├── AdapterInterface.js
│   ├── TrendyolAdapter.js
│   ├── HepsiburadaAdapter.js
│   └── N11Adapter.js
├── hooks/
│   ├── useSpeech.js
│   ├── useConversation.js
│   └── useVoiceAssistant.js
├── components/
│   ├── layout/SidePanel.jsx
│   ├── voice/{VoiceButton,VoiceStatus,TranscriptDisplay}.jsx
│   ├── products/{ProductList,ProductCard,ProductImage}.jsx
│   ├── analysis/{ReviewPanel,PriceComparison}.jsx
│   ├── conversation/ConversationHistory.jsx
│   └── ui/{AccessibleButton,LoadingSpinner,ErrorMessage}.jsx
├── routes/
│   ├── __root.tsx     ← TanStack shell
│   └── index.tsx      ← SidePanel'i render eder
└── styles.css         ← Tema token'ları, animasyonlar
```

### 5.1 `config/index.js`
Tüm sabitler ve env değişkenleri burada okunur. Hiçbir component `import.meta.env`'ye doğrudan dokunmaz.

```js
GEMINI_API_KEY      // .env'den okunur
USE_MOCK            // true ise tüm "Mock*" servisler kullanılır
SUPPORTED_SITES     // ['trendyol', 'hepsiburada', 'n11', 'amazon']
SPEECH_LANG         // 'tr-TR'
TIMEOUTS            // dinleme/yanıt zaman aşımları
STORAGE_KEYS        // localStorage anahtarları
STRINGS             // tüm UI metinleri (TR) — i18n için tek nokta
```

### 5.2 `types/index.js`
`Product`, `ReviewAnalysis`, `PriceResult`, `ConversationMessage`, `Intent` modellerinin JSDoc tanımları.

### 5.3 `services/ai/`
- **`AIServiceInterface.js`** → tüm AI servislerinin uyması gereken sözleşme: `parseIntent`, `analyzeImage`, `analyzeReviews`, `generateResponse`.
- **`MockAIService.js`** → API key gerektirmeden gerçekçi cevaplar döner. Türkçe regex ile basit niyet ayrıştırma.
- **`GeminiService.js`** → Google Generative Language API'ye REST çağrısı. JSON cevap parse'ı dahil. Üretim için sunucu proxy'si önerilir (key client'a sızmasın).

### 5.4 `services/speech/`
- **`SpeechServiceInterface.js`** → `startListening`, `stopListening`, `speak`, `stopSpeaking`, `isListening`, `isSpeaking`, `isSupported`.
- **`WebSpeechService.js`** → `SpeechRecognition` (Chromium prefixli) + `SpeechSynthesis` sarmalayıcı. Türkçe dil seçili. Hata callback'leri.

### 5.5 `services/search/`
- **`SearchServiceInterface.js`** → `searchProducts`, `getProductDetail`, `comparePrice`.
- **`MockSearchService.js`** → 4 gerçekçi mock ürün (Trendyol/Hepsiburada/N11) + sahte yorumlar + 3 mağazalı fiyat tablosu.
- **`ExtensionSearchService.js`** → `chrome.runtime.sendMessage` ile content script'lere mesaj gönderir. Extension'a paketlendiğinde aktive olur.

### 5.6 `services/ServiceFactory.js`
Tek karar noktası. `USE_MOCK` bayrağına bakar, doğru implementasyonu döner. Singleton.

```js
getAIService()     → MockAIService | GeminiService
getSpeechService() → WebSpeechService
getSearchService() → MockSearchService | ExtensionSearchService
```

### 5.7 `adapters/`
Site bazlı DOM parse ve arama URL üretimi.
- `AdapterInterface.js` → `siteName`, `urlPattern`, `extractProduct`, `extractReviews`, `extractPrice`, `buildSearchUrl`.
- `TrendyolAdapter.js`, `HepsiburadaAdapter.js`, `N11Adapter.js` → her biri kendi sitesinin URL pattern'ini ve arama URL şemasını bilir. DOM parse iskeleti hazır, gerçek selector'lar extension'a paketlerken doldurulur.

### 5.8 `hooks/`
- **`useSpeech.js`** → `WebSpeechService`'i React state'ine bağlar (`isListening`, `isSpeaking`).
- **`useConversation.js`** → `messages` listesini yönetir ve `localStorage`'a yazar.
- **`useVoiceAssistant.js`** → **Ana orkestratör.** Phase makinesi, intent parse → arama → seçim → analiz → karşılaştırma → sipariş geçişlerini yönetir. UI sadece bu hook'u tüketir.

### 5.9 `components/`
- **`layout/SidePanel.jsx`** → ana sayfa. Phase'e göre koşullu olarak `ProductList`, ürün detayı, `ReviewPanel`, `PriceComparison` gösterir.
- **`voice/VoiceButton.jsx`** → 120px mikrofon butonu. Dinlerken yeşil pulse, konuşurken ses dalgası.
- **`voice/VoiceStatus.jsx`** → "Dinliyorum / Arıyorum / Karşılaştırıyorum" gibi durum metni (`aria-live`).
- **`voice/TranscriptDisplay.jsx`** → kullanıcının söylediği metin.
- **`products/ProductList.jsx` + `ProductCard.jsx`** → numaralı ürün listesi. Her kart "1. Trendyol — 149 TL" şeklinde okunur (`aria-label`).
- **`products/ProductImage.jsx`** → görsel + AI'nın ürettiği `alt` metni `figcaption` olarak.
- **`analysis/ReviewPanel.jsx`** → Olumlu/Olumsuz chip'leri, duyusal blok, beden tavsiyesi, 10 üzerinden skor.
- **`analysis/PriceComparison.jsx`** → mağaza × toplam fiyat tablosu, en ucuz "EN UCUZ" rozetiyle vurgulanır.
- **`conversation/ConversationHistory.jsx`** → son 12 mesaj (kullanıcı sağda, asistan solda).
- **`ui/AccessibleButton.jsx`** → tüm butonların temel bileşeni. `ariaLabel` zorunlu prop, 52px min yükseklik, focus ring.
- **`ui/LoadingSpinner.jsx`**, **`ui/ErrorMessage.jsx`** → küçük yardımcılar (`role="status"`, `role="alert"`).

---

## 6. Veri Akışı ve Phase Diyagramı

```
            ┌──────────┐
            │   idle   │  ← Senara hazır
            └────┬─────┘
        mikrofon ↓
            ┌──────────┐
            │ listening│  ← Web Speech dinler
            └────┬─────┘
       transcript ↓
            ┌──────────┐
            │processing│  ← AI parseIntent + Search.search
            └────┬─────┘
                 ↓
            ┌──────────┐
            │  results │  ← Liste sesli okunur ("1, 2, 3")
            └────┬─────┘
   "birinci" ↓ (veya butonla)
            ┌─────────────────┐
            │ product_detail  │  ← analyzeImage + analyzeReviews
            └────┬────────────┘
"fiyat karşılaştır" ↓
            ┌──────────┐
            │comparing │  ← comparePrice()
            └────┬─────┘
        "al" ↓
            ┌──────────┐
            │ ordering │  ← mağazaya yönlendirme
            └──────────┘
```

Her phase geçişinde:
1. UI state güncellenir (koşullu render),
2. Asistan mesajı `conversation`'a eklenir,
3. `speech.speak()` ile sesli okunur,
4. `aria-live` bölgeleri ekran okuyucuyu bilgilendirir.

---

## 7. Konuşma Senaryosu (Uçtan Uca)

```
Senara:  "Merhaba! Ne aramak istersiniz?"
[Kullanıcı mikrofona basar]
Senara:  "Dinliyorum..."
Kullanıcı: "Siyah L beden tişört arıyorum"
Senara:  "Arama yapıyorum..."
Senara:  "4 ürün buldum.
          Birincisi: Basic Erkek Tişört, Trendyol, 149 TL, 4.5 yıldız.
          İkincisi: Oversize Tişört, Hepsiburada, 189 TL, 4.2 yıldız.
          Üçüncüsü: %100 Pamuk Tişört, N11, 129 TL, 4.7 yıldız.
          Detay için birinci, ikinci veya üçüncü deyin."
Kullanıcı: "Birinci"
Senara:  "Düz siyah tişört, yuvarlak yaka, hafif ince kumaş…
          342 yorum var. Olumlu: kumaş kaliteli, renk solmuyor.
          Olumsuz: küçük kaçıyor. Kumaş hissi: pamuklu, nefes alan.
          Bir beden büyük almanızı öneririm. Öneri skorum 10 üzerinden 8.
          Almak ister misiniz? Fiyat karşılaştırması yapalım mı?"
Kullanıcı: "Fiyat karşılaştır"
Senara:  "Trendyol 149 TL, kargo 29 TL.
          Hepsiburada 165 TL, kargo ücretsiz.
          N11 139 TL, kargo 19 TL.
          En ucuzu N11, toplam 158 TL. Almak ister misiniz?"
Kullanıcı: "Al"
Senara:  "En uygun mağazaya yönlendiriyorum, sepete ekleniyor..."
```

---

## 8. Genişletme Rehberi

### 8.1 Yeni Site Ekle (örn. Amazon)

`src/adapters/AmazonAdapter.js` oluştur:

```js
import { AdapterInterface } from "./AdapterInterface.js";

export class AmazonAdapter extends AdapterInterface {
  get siteName() { return "amazon"; }
  get urlPattern() { return /amazon\.com\.tr/i; }
  extractProduct(dom) { /* selector'larla parse */ }
  extractReviews(dom) { /* … */ }
  extractPrice(dom)   { /* … */ }
  buildSearchUrl(q)   {
    return `https://www.amazon.com.tr/s?k=${encodeURIComponent(q)}`;
  }
}
```

Başka **hiçbir dosyaya** dokunmana gerek yok. Adapter registry runtime'da otomatik çalışır.

### 8.2 Yeni AI Servisi Ekle (örn. OpenAI)

`src/services/ai/OpenAIService.js` oluştur, `AIServiceInterface`'i implemente et. Sonra `ServiceFactory.js`'de **tek satır**:

```js
export const getAIService = () =>
  USE_MOCK ? new MockAIService()
           : provider === "openai" ? new OpenAIService() : new GeminiService();
```

### 8.3 Yeni Phase Ekle

`useVoiceAssistant.js` içinde phase string'ini ekle, `SidePanel.jsx`'te koşullu render bloğu ekle, `VoiceStatus.jsx`'teki `PHASE_LABELS`'a bir satır ekle.

---

## 9. Kurulum ve Çalıştırma

Lovable preview'unda zaten otomatik çalışır. Yerel için:

```bash
bun install
bun run dev
```

`http://localhost:5173` adresinde açılır.

**Önemli:** Web Speech API yalnızca **Chromium tabanlı tarayıcılarda** (Chrome, Edge, Brave, Arc, Opera) çalışır. Mikrofon izni vermeniz gerekir.

---

## 10. Environment Değişkenleri

`.env` dosyası:

```ini
VITE_GEMINI_API_KEY=your_key_here
VITE_USE_MOCK=true
```

| Değişken | Anlamı | Varsayılan |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` ise tüm Mock servisler. `false` yapınca gerçek Gemini + extension servislerine geçilir. | `true` |
| `VITE_GEMINI_API_KEY` | `USE_MOCK=false` iken Gemini API çağrıları için. | boş |

> Üretimde Gemini key'i client'ta tutmak yerine sunucu proxy'si (TanStack server route, Cloudflare Worker vb.) önerilir.

---

## 11. Erişilebilirlik Detayları

- **Renk kontrastı:** Arka plan `#0a0a0a` × metin `#ffffff` = 19:1 (WCAG AAA).
- **Yazı boyutu:** Body 18px, başlıklar 22px+.
- **Tap target:** Tüm interaktif öğeler min **44×44px**, ana mikrofon 120×120px.
- **Focus halkası:** `:focus-visible` için 3px yeşil outline.
- **ARIA:**
  - `aria-live="polite"` → durum mesajları,
  - `aria-live="assertive"` → hata mesajları,
  - `aria-pressed` → mikrofon butonu,
  - `aria-label` → tüm ikon butonlar + ürün kartı özetleri,
  - `role="status"`, `role="alert"`.
- **Klavye:** `Space` / `Enter` → mikrofonu aç/kapat. Tab sıralaması doğal DOM sırası.
- **Renge bağımlılık yok:** "EN UCUZ" hem renk hem rozet metni, "Olumlu/Olumsuz" hem renk hem başlık.
- **`prefers-reduced-motion` not edildi** → ileri sürümde animasyonlar kapatılabilir.

---

## 12. Tasarım Sistemi

Tüm renkler `src/styles.css` içindeki `oklch` token'larıyla tanımlı. Hiçbir component'te hardcoded renk yok.

| Token | Değer | Kullanım |
| --- | --- | --- |
| `--background` | `oklch(0.13 0 0)` | Sayfa arkaplanı |
| `--foreground` | `oklch(1 0 0)` | Ana metin |
| `--card` | `oklch(0.18 0 0)` | Kart yüzeyleri |
| `--primary` | `oklch(0.72 0.18 145)` (≈ #22c55e) | Mikrofon, vurgu, CTA |
| `--muted-foreground` | `oklch(0.72 0 0)` | İkincil metin |
| `--destructive` | `oklch(0.65 0.22 25)` | Hata, olumsuz yorum |
| `--ring` | `--primary` ile aynı | Focus halkası |

Özel animasyonlar:
- `mic-pulse` → dinleme anında genişleyen yeşil halka.
- `wave` → konuşurken alttaki 5 çubuk dalga.

---

## 13. Chrome Extension'a Taşıma Yol Haritası

Bu uygulama Chrome Extension Side Panel API'sine taşınmak üzere tasarlandı.

### ✅ Tamamlanan Adımlar

1. **✅ `manifest.json`** — Manifest V3, side panel, background service worker, content scripts, permissions ve host_permissions tanımlandı.
2. **✅ `background.js`** — Service worker: ikon → side panel açma, tab URL değişim izleme, mesaj iletimi (side panel ↔ content script).
3. **✅ Content scripts** — `content_scripts/` klasöründe:
   - `injector.js` — Ana content script. Tüm sitelerde çalışır, inline adapter'larla DOM parse yapar.
   - `trendyol.js` — Trendyol SPA navigasyon izleme (MutationObserver + history override).
   - `hepsiburada.js` — Hepsiburada SPA navigasyon izleme.
   - `n11.js` — N11 SPA navigasyon izleme.
4. **✅ Vite build konfigürasyonu** — `vite.config.extension.ts` eklendi (IIFE format, content script uyumlu).
5. **✅ `package.json`** — `"build:extension"` script'i eklendi.
6. **✅ `.env.example`** — `VITE_USE_MOCK=false` şablonu eklendi.

### DOM Selector Bilgileri

| Site | Ürün Adı | Fiyat | Resim | Puan |
| --- | --- | --- | --- | --- |
| Trendyol | `[data-drroot] h1`, `.pr-new-br span` | `.prc-dsc`, `.prc-slg` | `.base-product-image img` | `.rnr-cm-rvw span` |
| Hepsiburada | `h1.product-name`, `[data-bind="text: name"]` | `.product-price .price` | `.product-image img` | `.ratings .rating` |
| N11 | `.proName h1` | `.newPrice ins` | `#productMainPicture img` | `.ratingCont .ratingScore` |

### Kalan Adımlar

- [ ] `VITE_USE_MOCK=false` yaparak `ExtensionSearchService`'i devreye al
- [ ] `bun run build:extension` ile build al ve `chrome://extensions` üzerinden test et
- [ ] Gerçek site HTML'lerine göre selector'ları güncelleyebilirsin (siteler DOM'u sık değiştirir)

UI tarafında **hiçbir değişiklik gerekmez**.

---

## 14. Bilinen Sınırlamalar

- **Web Speech API yalnız Chromium**'da var. Safari/Firefox kısmen veya hiç desteklemez. Mock mod bağımsız çalışır ama sesli giriş olmaz.
- **DOM selector'lar güncellenebilir** — E-ticaret siteleri sık DOM değişikliği yapar. `content_scripts/injector.js` içindeki selector'lar güncel tutulmalıdır.
- **Content script'lerde CORS kısıtı** — `fetch` ile farklı site aramak (fiyat karşılaştırma) CORS nedeniyle başarısız olabilir. Bu durumda `background.js`'e fetch proxy'si eklenebilir.
- **Gemini API key client'ta** kalırsa ayıklanabilir. Üretimde server proxy şart.
- **Niyet ayrıştırma (mock)** regex tabanlı, sınırlıdır. Gerçek modda Gemini çok daha doğru sonuç verir.
- **Sepet/ödeme entegrasyonu yok** — şu an sadece mağaza linkine yönlendiriyoruz. Otomatik sepete ekleme her sitenin login/CSRF politikasına özel iş gerektirir.
- **i18n yok** — tüm metinler `STRINGS` altında ama tek dil (TR). Çoklu dil için key/value mapping eklenebilir.

---

**Senara** — *konuşmak yeter.*
