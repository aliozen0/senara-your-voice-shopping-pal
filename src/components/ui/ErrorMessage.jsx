export function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl border-2 border-[color:var(--destructive)] bg-[color:var(--destructive)]/10 px-4 py-3 text-lg text-[color:var(--destructive)]"
    >
      <span aria-hidden="true" className="mr-2">⚠️</span>
      {message}
    </div>
  );
}
