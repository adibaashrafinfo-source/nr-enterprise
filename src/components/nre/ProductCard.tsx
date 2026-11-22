import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { PublicProductSummary } from "@/lib/types";

export function ProductCard({ product, onQuote }: { product: PublicProductSummary; onQuote?: (p: PublicProductSummary) => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift">
      <Link to="/products/$categorySlug/$productSlug" params={{ categorySlug: product.category.slug, productSlug: product.slug }} className="relative block aspect-[4/3] overflow-hidden bg-muted">
        {product.primary_image && <img src={product.primary_image} alt={product.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium backdrop-blur">{product.category.name}</span>
      </Link>
      <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <h3 className="font-semibold leading-tight">{product.name}</h3>
        <span className="text-xs font-medium opacity-70">{product.code}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="flex-1 text-sm text-muted-foreground">{product.short_description}</p>
        <Button variant="outline" size="sm" onClick={() => onQuote?.(product)}>Get quote</Button>
      </div>
    </article>
  );
}
