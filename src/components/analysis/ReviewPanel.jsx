export function ReviewPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <section
      aria-label="Yorum analizi"
      className="flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-[color:var(--foreground)]">Yorum Özeti</h3>
        <span
          aria-label={`Öneri skoru ${analysis.score} bölü 10`}
          className="rounded-full bg-[color:var(--primary)] px-3 py-1 text-base font-bold text-[color:var(--primary-foreground)]"
        >
          {analysis.score}/10
        </span>
      </header>
      <Block title="Olumlu" tone="positive" items={analysis.positive} />
      <Block title="Olumsuz" tone="negative" items={analysis.negative} />
      <Detail title="Kumaş & Duyusal" text={analysis.sensoryDesc} />
      <Detail title="Beden Tavsiyesi" text={analysis.sizeAdvice} />
    </section>
  );
}

function Block({ title, items, tone }) {
  const color = tone === "positive" ? "var(--primary)" : "var(--destructive)";
  return (
    <div>
      <h4
        className="mb-1 text-sm font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        {title}
      </h4>
      <ul className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--secondary)] px-3 py-1 text-base text-[color:var(--foreground)]"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ title, text }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {title}
      </h4>
      <p className="text-base text-[color:var(--foreground)]">{text}</p>
    </div>
  );
}
