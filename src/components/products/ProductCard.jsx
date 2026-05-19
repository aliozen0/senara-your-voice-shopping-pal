import { AccessibleButton } from "../ui/AccessibleButton.jsx";

export function ProductCard({ product, index, onSelect }) {
  const aria = `${index + 1}. ürün: ${product.name}, ${product.store}, ${product.price} TL, ${product.rating} yıldız`;
  return (
    <article
      aria-label={aria}
      className="flex gap-4 rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--card)] p-4 transition-colors focus-within:border-[color:var(--primary)] hover:border-[color:var(--primary)]"
    >
      <img
        src={product.imageUrl}
        alt=""
        aria-hidden="true"
        className="h-24 w-24 flex-shrink-0 rounded-xl object-cover bg-[color:var(--secondary)]"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-[color:var(--primary)]">
            {index + 1}. {product.store}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-[color:var(--foreground)] line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-base text-[color:var(--muted-foreground)]">
            <span>
              <span aria-hidden="true">⭐</span>{" "}
              <span aria-label={`${product.rating} yıldız`}>{product.rating}</span>
            </span>
            <span aria-hidden="true">•</span>
            <span className="text-xl font-bold text-[color:var(--foreground)]">
              {product.price} TL
            </span>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <AccessibleButton
            ariaLabel={`${product.name} ürününü seç ve detayları dinle`}
            onClick={() => onSelect?.(product)}
            className="min-h-[44px] px-4 text-base"
          >
            Seç
          </AccessibleButton>
        </div>
      </div>
    </article>
  );
}
