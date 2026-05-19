export function PriceComparison({ results }) {
  if (!results?.length) return null;
  const enriched = results
    .map((r) => ({ ...r, total: r.price + r.shipping }))
    .sort((a, b) => a.total - b.total);
  const cheapestStore = enriched[0].store;

  return (
    <section
      aria-label="Fiyat karşılaştırma"
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
    >
      <h3 className="mb-3 text-xl font-bold text-[color:var(--foreground)]">
        Fiyat Karşılaştırma
      </h3>
      <ul className="flex flex-col gap-2">
        {enriched.map((r) => {
          const isCheapest = r.store === cheapestStore;
          return (
            <li
              key={r.store}
              aria-label={`${r.store} ${r.price} lira, kargo ${r.shipping === 0 ? "ücretsiz" : r.shipping + " lira"}, toplam ${r.total} lira${isCheapest ? ", en uygun fiyat" : ""}`}
              className={[
                "flex items-center justify-between rounded-xl border-2 px-4 py-3",
                isCheapest
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10"
                  : "border-[color:var(--border)] bg-[color:var(--secondary)]",
              ].join(" ")}
            >
              <div className="flex flex-col">
                <span className="text-lg font-bold text-[color:var(--foreground)]">
                  {r.store}{" "}
                  {isCheapest && (
                    <span className="ml-2 rounded-full bg-[color:var(--primary)] px-2 py-0.5 text-xs font-bold text-[color:var(--primary-foreground)]">
                      EN UCUZ
                    </span>
                  )}
                </span>
                <span className="text-sm text-[color:var(--muted-foreground)]">
                  Kargo: {r.shipping === 0 ? "Ücretsiz" : `${r.shipping} TL`}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[color:var(--foreground)]">
                  {r.total} TL
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
