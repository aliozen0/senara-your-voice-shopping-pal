import { STRINGS } from "../../config/index.js";

export function VoiceButton({ isListening, isSpeaking, onClick, disabled }) {
  const state = isListening ? "listening" : isSpeaking ? "speaking" : "idle";
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={STRINGS.micLabel}
        aria-pressed={isListening}
        className={[
          "relative flex h-[120px] w-[120px] items-center justify-center rounded-full",
          "transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--ring)]",
          state === "listening"
            ? "bg-[color:var(--primary)] shadow-[0_0_0_0_rgba(34,197,94,0.6)] animate-mic-pulse"
            : state === "speaking"
              ? "bg-[color:var(--primary)]/80"
              : "bg-[color:var(--secondary)] hover:bg-[color:var(--secondary)]/80",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <MicIcon active={state !== "idle"} />
        {state === "speaking" && (
          <span className="absolute -bottom-1 flex gap-1" aria-hidden="true">
            <Bar delay="0ms" />
            <Bar delay="120ms" />
            <Bar delay="240ms" />
            <Bar delay="120ms" />
            <Bar delay="0ms" />
          </span>
        )}
      </button>
    </div>
  );
}

function MicIcon({ active }) {
  const color = active ? "var(--primary-foreground)" : "var(--foreground)";
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" stroke={color} strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Bar({ delay }) {
  return (
    <span
      className="inline-block w-1 rounded-full bg-[color:var(--primary-foreground)] animate-wave"
      style={{ animationDelay: delay, height: "16px" }}
    />
  );
}
