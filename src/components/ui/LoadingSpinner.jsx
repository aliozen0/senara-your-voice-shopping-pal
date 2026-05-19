export function LoadingSpinner({ label = "Yükleniyor" }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--muted-foreground)] border-t-[color:var(--primary)]"
      />
      <span className="text-base text-[color:var(--muted-foreground)]">{label}</span>
    </div>
  );
}
