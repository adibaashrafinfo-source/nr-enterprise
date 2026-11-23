import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/nre/ProductCard";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { EmptyState } from "@/components/nre/EmptyState";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { publicApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { pageHead } from "@/lib/seo";

const PER_PAGE = 12;
const TITLE = "Products — Labels, Tags & Trims | NR Enterprise";
const DESC = "Browse 19 garment trims and accessories: woven and care labels, hangtags, barcode and RFID labels, sewing thread, elastic, drawcords and buttons.";

interface Search { q?: string; category?: string; page?: number }

export const Route = createFileRoute("/_site/products/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["q"] === "string" && s["q"]) out.q = s["q"];
    if (typeof s["category"] === "string" && s["category"]) out.category = s["category"];
    const page = Number(s["page"]);
    if (Number.isInteger(page) && page > 1) out.page = page;
    return out;
  },
  head: () => pageHead(TITLE, DESC, "/products"),
  component: Products,
});

function Products() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const go = (next: Search) => {
    const out: Search = {};
    if (next.q) out.q = next.q;
    if (next.category) out.category = next.category;
    if (next.page && next.page > 1) out.page = next.page;
    return navigate({ search: out, replace: true });
  };
  const page = search.page ?? 1;
  const [q, setQ] = useState(search.q ?? "");
  const { data: categories = [] } = useQuery(categoriesQuery());

  const params = { per_page: PER_PAGE, page, ...(search.q ? { q: search.q } : {}), ...(search.category ? { category: search.category } : {}) };
  const list = useQuery({ ...productsQuery(params), queryFn: () => publicApi.products(params), placeholderData: keepPreviousData });

  useEffect(() => {
    if (q === (search.q ?? "")) return;
    const t = setTimeout(() => void go({ ...search, q, page: 1 }), 300);
    return () => clearTimeout(t);
  }, [q, search, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = list.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const setCategory = (category?: string) => void go({ ...search, ...(category ? { category } : { category: "" }), page: 1 });
  const goPage = (p: number) => void go({ ...search, page: p });

  return (
    <>
      <section className="relative overflow-hidden bg-cream">
        <div className="nr-dotted absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-14">
          <h1 className="heading-bar text-3xl font-bold tracking-tight md:text-4xl">Our products</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">Labels, tags, stickers and trims. Search by name or product code.</p>
          <label className="relative mt-6 block max-w-md">
            <span className="sr-only">Search products</span>
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search e.g. woven, RFID, WL" className="h-12 rounded-full bg-background pl-11" />
          </label>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
          {[{ slug: undefined, name: "All" }, ...categories].map((c) => {
            const active = search.category === c.slug;
            return (
              <button key={c.name} role="tab" aria-selected={active} onClick={() => setCategory(c.slug)}
                className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>
                {c.name}
              </button>
            );
          })}
        </div>

        {list.isLoading ? <LoadingSkeleton variant="cards" rows={6} />
          : list.isError ? <EmptyState title="Couldn't load products" description="Please try again in a moment." />
          : list.data!.data.length === 0 ? <EmptyState title="No products found" description="Try a different search or category." />
          : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.data!.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              {pages > 1 && (
                <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                  <Button variant="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => goPage(page - 1)}><ChevronLeft /></Button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                    <Button key={n} size="icon" variant={n === page ? "default" : "ghost"} aria-current={n === page ? "page" : undefined} onClick={() => goPage(n)}>{n}</Button>
                  ))}
                  <Button variant="ghost" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => goPage(page + 1)}><ChevronRight /></Button>
                </nav>
              )}
            </>
          )}

        <div className="mt-16 flex flex-col items-start justify-between gap-4 rounded-2xl bg-ink-green p-8 text-on-dark md:flex-row md:items-center">
          <div><h2 className="text-xl font-semibold">Not sure what you need?</h2><p className="mt-1 opacity-80">Send us a sample or your artwork and we'll match it.</p></div>
          <Button asChild><Link to="/contact" search={{ sample: 1 }}>Send a sample</Link></Button>
        </div>
      </section>
    </>
  );
}
