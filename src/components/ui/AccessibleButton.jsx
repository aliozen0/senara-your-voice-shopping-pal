import { forwardRef } from "react";

/**
 * Tüm butonların temel bileşeni.
 * aria-label zorunludur (görsel olarak metin yoksa).
 */
export const AccessibleButton = forwardRef(function AccessibleButton(
  { children, ariaLabel, variant = "primary", className = "", ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-colors " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--ring)] " +
    "disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px] px-6 text-lg";
  const variants = {
    primary: "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90",
    secondary: "bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] hover:opacity-90",
    ghost: "bg-transparent text-[color:var(--foreground)] border border-[color:var(--border)] hover:bg-[color:var(--secondary)]",
    danger: "bg-[color:var(--destructive)] text-[color:var(--destructive-foreground)] hover:opacity-90",
  };
  return (
    <button
      ref={ref}
      aria-label={ariaLabel}
      className={`${base} ${variants[variant] ?? variants.primary} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
