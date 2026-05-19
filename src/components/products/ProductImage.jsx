export function ProductImage({ src, alt, description }) {
  return (
    <figure className="flex flex-col gap-2">
      <img
        src={src}
        alt={description || alt || "Ürün görseli"}
        className="aspect-square w-full rounded-xl object-cover bg-[color:var(--secondary)]"
        loading="lazy"
      />
      {description && (
        <figcaption className="text-base text-[color:var(--muted-foreground)]">
          <span className="sr-only">Görsel açıklaması: </span>
          {description}
        </figcaption>
      )}
    </figure>
  );
}
