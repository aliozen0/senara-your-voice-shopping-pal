export function ConversationHistory({ messages }) {
  if (!messages?.length) return null;
  return (
    <section
      aria-label="Konuşma geçmişi"
      className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        Konuşma
      </h3>
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {messages.slice(-12).map((m, i) => (
          <li
            key={i}
            className={[
              "rounded-xl px-3 py-2 text-base",
              m.role === "user"
                ? "self-end bg-[color:var(--primary)] text-[color:var(--primary-foreground)] max-w-[85%]"
                : "self-start bg-[color:var(--secondary)] text-[color:var(--foreground)] max-w-[95%]",
            ].join(" ")}
          >
            <span className="sr-only">{m.role === "user" ? "Siz: " : "Asistan: "}</span>
            {m.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
