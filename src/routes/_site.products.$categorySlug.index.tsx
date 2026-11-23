import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/nre/ProductCard";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { EmptyState } from "@/components/nre/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { canPrefetch } from "@/config/flags";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_site/products/$categorySlug/")({
  loader: async ({ context, params }) => {
    if (!canPrefetch()) return null;
    const cats = await context.queryClient.ensureQueryData(categoriesQuery());
    const cat = cats.find((c) => c.slug === params.categorySlug);
    if (!cat) throw notFound();
    await context.queryClient.ensureQueryData(productsQuery({ category: cat.slug, per_page: 48 }));
    return { name: cat.name, description: cat.description, image: cat.image_url };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — NR Enterprise` : "Product category — NR Enterprise";
    const desc = loaderData?.description ?? "Garment trims and accessories by category.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  notFoundComponent: () => <div className="mx-auto max-w-7xl px-4 py-20"><EmptyState title="Category not found" action={<Link to="/products" className="font-semibold text-secondary">See all products</Link>} /></div>,
  component: CategoryPage,
});

function CategoryPage() {
  const { categorySlug } = Route.useParams();
  const { data: categories = [], isLoading: catsLoading } = useQuery(categoriesQuery());
  const list = useQuery(productsQuery({ category: categorySlug, per_page: 48 }));
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<"featured" | "name">("featured");
  const cat = categories.find((c) => c.slug === categorySlug);

  const rows = useMemo(() => {
    let r = list.data?.data ?? [];
    if (type !== "all") r = r.filter((p) => p.slug === type);
    return [...r].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order);
  }, [list.data, type, sort]);

  if (!catsLoading && !cat) return <div className="mx-auto max-w-7xl px-4 py-20"><EmptyState title="Category not found" /></div>;

  return (
    <>
      <section className="relative overflow-hidden bg-ink-green text-on-dark">
        {cat && <img src={cat.image_url} alt="" className="absolute inset-0 size-full object-cover opacity-25" />}
        <div className="nr-dotted absolute inset-0 opacity-30" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-20">
          <nav className="mb-4 text-sm opacity-80" aria-label="Breadcrumb"><Link to="/" className="hover:underline">Home</Link> / <Link to="/products" className="hover:underline">Products</Link> / <span>{cat?.name}</span></nav>
          <h1 className="heading-bar text-3xl font-bold tracking-tight md:text-5xl">{cat?.name ?? "…"}</h1>
          <p className="mt-5 max-w-xl text-lg opacity-85">{cat?.description}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product type">
            {[{ slug: "all", name: "All" }, ...(list.data?.data ?? [])].map((p) => (
              <button key={p.slug} role="tab" aria-selected={type === p.slug} onClick={() => setType(p.slug)}
                className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-medium", type === p.slug ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>{p.name}</button>
            ))}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as "featured" | "name")}>
            <SelectTrigger className="w-44 rounded-full" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="featured">Featured first</SelectItem><SelectItem value="name">Name A–Z</SelectItem></SelectContent>
          </Select>
        </div>
        {list.isLoading ? <LoadingSkeleton variant="cards" rows={3} />
          : list.isError ? <EmptyState title="Couldn't load products" />
          : rows.length === 0 ? <EmptyState title="No products in this category yet" />
          : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rows.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
      </section>

      <section className="bg-cream py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="heading-bar text-2xl font-bold">Other ranges</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {categories.filter((c) => c.slug !== categorySlug).map((c) => (
              <Link key={c.slug} to="/products/$categorySlug" params={{ categorySlug: c.slug }} className="group flex items-center gap-5 overflow-hidden rounded-2xl border bg-card p-4 shadow-soft hover:shadow-lift">
                <img src={c.image_url} alt="" loading="lazy" className="size-24 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0"><h3 className="font-semibold">{c.name}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-secondary">Explore <ArrowRight className="size-4" /></span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
