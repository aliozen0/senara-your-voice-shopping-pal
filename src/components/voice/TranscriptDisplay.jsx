export function TranscriptDisplay({ transcript }) {
  if (!transcript) return null;
  return (
    <div
      aria-label="Söylediğiniz"
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--secondary)] px-5 py-4 text-lg text-[color:var(--foreground)]"
    >
      <span className="block text-sm font-medium uppercase tracking-wide text-[color:var(--muted-foreground)]">
        Siz dediniz
      </span>
      <span className="mt-1 block text-xl">"{transcript}"</span>
    </div>
  );
}
