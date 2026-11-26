import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageSquarePlus } from "lucide-react";
import type { PublicProductSummary } from "@/lib/types";
import { useQuote } from "@/components/site/QuoteDrawer";

export function ProductCard({ product }: { product: PublicProductSummary }) {
  const { openQuote } = useQuote();
  const to = { categorySlug: product.category.slug, productSlug: product.slug };
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link to="/products/$categorySlug/$productSlug" params={to} className="relative block aspect-[4/3] overflow-hidden bg-muted">
        {product.primary_image && <img src={product.primary_image} alt={product.name} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur">{product.category.name}</span>
        <span className="absolute bottom-3 right-3 grid size-9 translate-y-2 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lift transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden><ArrowUpRight className="size-4" /></span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug"><Link to="/products/$categorySlug/$productSlug" params={to} className="hover:text-secondary">{product.name}</Link></h3>
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{product.code}</span>
        </div>
        <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{product.short_description}</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link to="/products/$categorySlug/$productSlug" params={to} className="inline-flex h-10 items-center justify-center rounded-full border border-secondary/30 text-sm font-semibold text-secondary transition-colors hover:border-secondary hover:bg-accent">Details</Link>
          <button type="button" onClick={() => openQuote(product)} className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary-hover hover:shadow-lift active:scale-[0.98]"><MessageSquarePlus className="size-4" />Get quote</button>
        </div>
      </div>
    </article>
  );
}
