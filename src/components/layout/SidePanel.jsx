import { useEffect, useRef, useState } from "react";
import { useVoiceAssistant } from "../../hooks/useVoiceAssistant.js";
import { VoiceButton } from "../voice/VoiceButton.jsx";
import { VoiceStatus } from "../voice/VoiceStatus.jsx";
import { TranscriptDisplay } from "../voice/TranscriptDisplay.jsx";
import { ProductList } from "../products/ProductList.jsx";
import { ProductImage } from "../products/ProductImage.jsx";
import { ReviewPanel } from "../analysis/ReviewPanel.jsx";
import { PriceComparison } from "../analysis/PriceComparison.jsx";
import { ConversationHistory } from "../conversation/ConversationHistory.jsx";
import { ErrorMessage } from "../ui/ErrorMessage.jsx";
import { AccessibleButton } from "../ui/AccessibleButton.jsx";
import { WardrobeService } from "../../services/wardrobe/WardrobeService.js";
import { STRINGS } from "../../config/index.js";

export function SidePanel() {
  const v = useVoiceAssistant();
  const greetedRef = useRef(false);
  const [showWardrobe, setShowWardrobe] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState([]);

  // Sayfa açılınca sesli karşılama yap (bir kez).
  // Kullanıcı mikrofona basarsa speechSynthesis.cancel() ile kesilir.
  useEffect(() => {
    if (!greetedRef.current && v.isSupported) {
      greetedRef.current = true;
      const timer = setTimeout(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel(); // önceki kalıntı varsa temizle
          const utter = new SpeechSynthesisUtterance(
            "Merhaba! Ben Senara, sesli alışveriş asistanınız. " +
            "Mikrofona bir kez dokunun, sonra ne aradığınızı söyleyin."
          );
          utter.lang = "tr-TR";
          utter.rate = 1.05;
          window.speechSynthesis.speak(utter);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [v.isSupported]);

  // Klavye kısayolu: Space/Enter
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "BUTTON" || e.target?.tagName === "INPUT") return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        v.toggleListening();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [v]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--foreground)]">
            {STRINGS.appName}
          </h1>
          <p className="text-base text-[color:var(--muted-foreground)]">
            {STRINGS.tagline}
          </p>
        </div>
        <div className="flex gap-2">
          <AccessibleButton
            ariaLabel="Dolabımı göster"
            variant="ghost"
            onClick={() => {
              setWardrobeItems(WardrobeService.getAll());
              setShowWardrobe(!showWardrobe);
            }}
            className="min-h-[44px] px-4 text-base"
          >
            👗 Dolabım ({WardrobeService.getAll().length})
          </AccessibleButton>
          {v.isSpeaking && (
            <AccessibleButton
              ariaLabel={STRINGS.stopSpeakingLabel}
              variant="ghost"
              onClick={v.stopSpeaking}
              className="min-h-[44px] px-4 text-base"
            >
              Durdur
            </AccessibleButton>
          )}
          {v.phase !== "idle" && (
            <AccessibleButton
              ariaLabel="Sıfırla"
              variant="ghost"
              onClick={v.reset}
              className="min-h-[44px] px-4 text-base"
            >
              Sıfırla
            </AccessibleButton>
          )}
        </div>
      </header>

      <section
        aria-label="Sesli komut bölgesi"
        className="flex flex-col items-center gap-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6"
      >
        <VoiceButton
          isListening={v.isListening}
          isSpeaking={v.isSpeaking}
          onClick={v.toggleListening}
          disabled={!v.isSupported}
        />
        <VoiceStatus phase={v.phase} isSpeaking={v.isSpeaking} />

        {/* Eller-serbest modu göstergesi */}
        {v.handsFree && (
          <p
            className="flex items-center gap-2 text-sm font-medium text-[color:var(--primary)]"
            aria-live="polite"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--primary)] animate-mic-pulse" aria-hidden="true" />
            Eller-serbest mod aktif — sesle devam edin
          </p>
        )}

        <p className="text-center text-base text-[color:var(--muted-foreground)]">
          {v.phase === "idle"
            ? "Mikrofona dokunun veya boşluk tuşuna basın"
            : v.phase === "listening"
              ? "Sizi dinliyorum..."
              : v.phase === "results"
                ? "Birinci, ikinci veya üçüncü deyin"
                : v.phase === "product_detail"
                  ? "'Fiyat karşılaştır', 'bu bana uyar mı' veya 'dolabıma ekle' deyin"
                  : v.phase === "comparing"
                    ? "'Al' veya yeni arama yapın"
                    : STRINGS.tapToStart}
        </p>
      </section>

      <ErrorMessage message={v.error} />
      <TranscriptDisplay transcript={v.transcript} />

      {v.phase === "results" && (
        <ProductList products={v.products} onSelect={v.selectProduct} />
      )}

      {(v.phase === "product_detail" || v.phase === "comparing" || v.phase === "ordering") &&
        v.selectedProduct && (
          <section
            aria-label="Seçili ürün detayı"
            className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
          >
            <h2 className="text-xl font-bold text-[color:var(--foreground)]">
              {v.selectedProduct.name}
            </h2>
            <ProductImage
              src={v.selectedProduct.imageUrl}
              alt={v.selectedProduct.name}
              description={v.imageDescription}
            />
            <ReviewPanel analysis={v.reviewAnalysis} />
            {v.phase !== "product_detail" && <PriceComparison results={v.priceResults} />}
            <div className="flex flex-wrap gap-2">
              {v.phase === "product_detail" && (
                <>
                  <AccessibleButton
                    ariaLabel="Fiyat karşılaştırması yap"
                    onClick={() => v.runCompare(v.selectedProduct)}
                  >
                    Fiyat Karşılaştır
                  </AccessibleButton>
                  <AccessibleButton
                    ariaLabel="Dolabıma ekle"
                    onClick={() => {
                      const added = WardrobeService.add(v.selectedProduct);
                      if (added) {
                        v.handleUserInput("dolabıma ekle");
                      } else {
                        alert("Bu ürün zaten dolabınızda!");
                      }
                    }}
                    className="min-h-[44px] px-4 text-base bg-[color:var(--secondary)]"
                  >
                    👗 Dolabıma Ekle
                  </AccessibleButton>
                  <AccessibleButton
                    ariaLabel="Bu bana uyar mı"
                    onClick={() => v.handleUserInput("bu bana uyar mı")}
                    className="min-h-[44px] px-4 text-base bg-[color:var(--secondary)]"
                  >
                    📏 Bana Uyar mı?
                  </AccessibleButton>
                </>
              )}
              {v.phase === "comparing" && (
                <AccessibleButton
                  ariaLabel="Siparişi onayla"
                  onClick={() => v.handleUserInput("al")}
                >
                  Al
                </AccessibleButton>
              )}
              {v.phase === "ordering" && (
                <a
                  href={v.selectedProduct.productUrl || v.selectedProduct.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[color:var(--primary)] px-6 text-lg font-semibold text-[color:var(--primary-foreground)]"
                  aria-label={`${v.selectedProduct.storeName || v.selectedProduct.store} sitesinde aç`}
                >
                  Mağazaya Git
                </a>
              )}
            </div>
          </section>
        )}

      {/* ── DOLAP HAFIZASI BÖLÜMÜ ── */}
      {showWardrobe && (
        <section
          aria-label="Dolap hafızası"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
        >
          <h2 className="text-xl font-bold text-[color:var(--foreground)] mb-3">👗 Dolabım</h2>
          {wardrobeItems.length === 0 ? (
            <p className="text-base text-[color:var(--muted-foreground)]">
              Dolabınız boş. Bir ürün detayında "Dolabıma Ekle" butonuna basın veya sesle "dolabıma ekle" deyin.
            </p>
          ) : (
            <ul className="space-y-2">
              {wardrobeItems.map((item, i) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[color:var(--foreground)] truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {item.price} {item.currency}
                      </p>
                    </div>
                  </div>
                  <AccessibleButton
                    ariaLabel={`${item.name} ürününü dolaptan çıkar`}
                    variant="ghost"
                    onClick={() => {
                      WardrobeService.remove(item.id);
                      setWardrobeItems(WardrobeService.getAll());
                    }}
                    className="text-sm px-2 min-h-[36px] text-red-400 hover:text-red-300"
                  >
                    ✕
                  </AccessibleButton>
                </li>
              ))}
            </ul>
          )}
          {wardrobeItems.length > 0 && (
            <div className="mt-3 flex gap-2">
              <AccessibleButton
                ariaLabel="Kombin önerisi al"
                onClick={() => v.handleUserInput("buna ne giyebilirim")}
                className="text-sm"
              >
                🎨 Kombin Öner
              </AccessibleButton>
              <AccessibleButton
                ariaLabel="Dolabı temizle"
                variant="ghost"
                onClick={() => {
                  WardrobeService.clear();
                  setWardrobeItems([]);
                }}
                className="text-sm text-red-400"
              >
                Temizle
              </AccessibleButton>
            </div>
          )}
        </section>
      )}

      <ConversationHistory messages={v.messages} />
    </main>
  );
}
