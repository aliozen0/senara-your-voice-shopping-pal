import { ProductCard } from "./ProductCard.jsx";

export function ProductList({ products, onSelect }) {
  if (!products?.length) return null;
  return (
    <section aria-label="Bulunan ürünler" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-[color:var(--foreground)]">
        {products.length} ürün bulundu
      </h2>
      <ul className="flex flex-col gap-3">
        {products.map((p, i) => (
          <li key={p.id}>
            <ProductCard product={p} index={i} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  );
}
