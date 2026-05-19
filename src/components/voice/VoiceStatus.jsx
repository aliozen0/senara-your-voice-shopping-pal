const PHASE_LABELS = {
  idle: "Hazırım",
  listening: "Dinliyorum...",
  processing: "Arıyorum...",
  results: "Sonuçlar geldi",
  product_detail: "Ürünü inceliyorum",
  comparing: "Fiyatları karşılaştırıyorum",
  ordering: "Siparişe yönlendiriyorum",
  error: "Hata",
};

export function VoiceStatus({ phase, isSpeaking }) {
  const label = PHASE_LABELS[phase] ?? phase;
  return (
    <div
      role="status"
      aria-live="polite"
      className="text-center text-xl font-medium text-[color:var(--muted-foreground)]"
    >
      {isSpeaking ? "Sesli okuyorum..." : label}
    </div>
  );
}
