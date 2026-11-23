import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Leaf, MessageCircle, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductCard } from "@/components/nre/ProductCard";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { useQuote } from "@/components/site/QuoteDrawer";
import { productQuery, settingsQuery } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { waHref } from "@/lib/contact";
import { formatQty } from "@/lib/money";
import { canPrefetch } from "@/config/flags";
import { canonicalUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { PublicProduct } from "@/lib/types";

export const Route = createFileRoute("/_site/products/$categorySlug/$productSlug")({
  loader: async ({ context, params }) => {
    if (!canPrefetch()) return null;
    try {
      const p = await context.queryClient.ensureQueryData(productQuery(params.productSlug));
      return { name: p.name, code: p.code, description: p.short_description, image: p.images[0]?.url ?? null, category: p.category.name };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData, params }) => {
    const links = [{ rel: "canonical", href: canonicalUrl(`/products/${params.categorySlug}/${params.productSlug}`) }];
    if (!loaderData) return { meta: [{ title: "Product — NR Enterprise" }, { name: "description", content: "Garment trims and accessories from NR Enterprise." }, { property: "og:title", content: "Product — NR Enterprise" }, { property: "og:description", content: "Garment trims and accessories from NR Enterprise." }, { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" }], links };
    const title = `${loaderData.name} (${loaderData.code}) — NR Enterprise`;
    const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: loaderData.name, sku: loaderData.code, description: loaderData.description, category: loaderData.category, ...(loaderData.image ? { image: loaderData.image } : {}), brand: { "@type": "Organization", name: "NR Enterprise" } };
    return {
      meta: [{ title }, { name: "description", content: loaderData.description }, { property: "og:title", content: title }, { property: "og:description", content: loaderData.description }, { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" }],
      links,
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  notFoundComponent: () => <div className="mx-auto max-w-7xl px-4 py-20"><EmptyState title="Product not found" action={<Link to="/products" className="font-semibold text-secondary">See all products</Link>} /></div>,
  component: ProductPage,
});

const humanize = (k: string) => k.replace(/_/g, " ").replace(/\bmm\b/, "(mm)").replace(/\bm\b/, "(m)").replace(/^./, (c) => c.toUpperCase());

function ProductPage() {
  const { productSlug } = Route.useParams();
  const { data: p, isLoading, isError } = useQuery(productQuery(productSlug));
  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-12"><LoadingSkeleton variant="cards" rows={2} /></div>;
  if (isError || !p) return <div className="mx-auto max-w-7xl px-4 py-20"><EmptyState title="Product not found" /></div>;
  return <ProductView p={p} />;
}

function ProductView({ p }: { p: PublicProduct }) {
  const { openQuote } = useQuote();
  const { data: s } = useQuery(settingsQuery());
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const img = p.images[active] ?? p.images[0];
  const wa = waHref(s?.whatsapp, `Hello NR Enterprise, I'm interested in ${p.name} (${p.code}).`);

  const specs = p.specs as { fields?: string[]; finishing?: string[] } & Record<string, unknown>;
  const optionLists = Object.entries(specs).filter(([k, v]) => k !== "fields" && k !== "finishing" && Array.isArray(v)) as [string, string[]][];
  const finishing = Array.isArray(specs.finishing) ? specs.finishing : [];
  const variantChips = [...new Set(p.variants.flatMap((v) => [v.color, v.size].filter((x): x is string => !!x)))];

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
        <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-secondary">Home</Link> / <Link to="/products" className="hover:text-secondary">Products</Link> / <Link to="/products/$categorySlug" params={{ categorySlug: p.category.slug }} className="hover:text-secondary">{p.category.name}</Link> / <span className="text-foreground">{p.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <button type="button" onClick={() => setZoom(true)} className="group relative block w-full overflow-hidden rounded-2xl border bg-muted" aria-label="Zoom image">
              {img && <img src={img.url} alt={p.name} className="aspect-square w-full object-cover" />}
              <span className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-background/90 shadow-soft"><ZoomIn className="size-5" /></span>
            </button>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {p.images.map((im, i) => (
                <button key={im.id} type="button" onClick={() => setActive(i)} aria-label={`Show image ${i + 1}`}
                  className={cn("overflow-hidden rounded-xl border-2", i === active ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}>
                  <img src={im.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium">{p.category.name}</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{p.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Code: <b className="text-foreground">{p.code}</b></p>
            <p className="mt-4 text-lg text-muted-foreground">{p.short_description}</p>
            <ul className="mt-6 space-y-2">
              {p.features.map((f) => <li key={f} className="flex gap-2"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>{f}</li>)}
            </ul>
            {variantChips.length > 0 && (
              <div className="mt-6"><p className="mb-2 text-sm font-semibold">Available options</p><div className="flex flex-wrap gap-2">{variantChips.map((v) => <span key={v} className="rounded-full border px-3 py-1 text-sm">{v}</span>)}</div></div>
            )}
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-cream px-5 py-3 text-sm">
              <span className="text-muted-foreground">Minimum order</span><b>{formatQty(p.moq, p.unit_code)}</b>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => openQuote(p)}>Request a Quote</Button>
              {wa && <Button asChild size="lg" variant="outline"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp this product</a></Button>}
            </div>
          </div>
        </div>

        <Tabs defaultValue="description" className="mt-14">
          <TabsList className="h-auto flex-wrap rounded-full bg-muted p-1">
            <TabsTrigger value="description" className="rounded-full">Description</TabsTrigger>
            <TabsTrigger value="specs" className="rounded-full">Specifications</TabsTrigger>
            {finishing.length > 0 && <TabsTrigger value="finishing" className="rounded-full">Finishing options</TabsTrigger>}
            <TabsTrigger value="sustainability" className="rounded-full">Sustainability</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-6 max-w-3xl leading-relaxed text-muted-foreground">{p.description}</TabsContent>
          <TabsContent value="specs" className="mt-6 max-w-3xl">
            <table className="w-full overflow-hidden rounded-2xl border text-sm">
              <tbody>
                {optionLists.map(([k, v]) => <tr key={k} className="border-b"><th className="w-1/3 bg-cream px-4 py-3 text-left font-medium">{humanize(k)}</th><td className="px-4 py-3">{v.join(", ")}</td></tr>)}
                {(specs.fields ?? []).map((f) => <tr key={f} className="border-b last:border-0"><th className="w-1/3 bg-cream px-4 py-3 text-left font-medium">{humanize(f)}</th><td className="px-4 py-3 text-muted-foreground">Made to your specification</td></tr>)}
                <tr><th className="w-1/3 bg-cream px-4 py-3 text-left font-medium">Unit</th><td className="px-4 py-3">{p.unit_code}</td></tr>
              </tbody>
            </table>
          </TabsContent>
          {finishing.length > 0 && (
            <TabsContent value="finishing" className="mt-6 flex max-w-3xl flex-wrap gap-2">{finishing.map((f) => <span key={f} className="rounded-full bg-accent px-4 py-2 text-sm font-medium">{f}</span>)}</TabsContent>
          )}
          <TabsContent value="sustainability" className="mt-6 flex max-w-3xl gap-3 text-muted-foreground"><Leaf className="size-5 shrink-0 text-secondary" />Ask us about recycled-quality and lower-impact material options for this product.</TabsContent>
        </Tabs>
      </div>

      {p.related.length > 0 && (
        <section className="bg-cream py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="heading-bar text-2xl font-bold">Related products</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{p.related.map((r) => <ProductCard key={r.id} product={r} />)}</div>
          </div>
        </section>
      )}

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-4xl rounded-2xl p-2">
          <DialogTitle className="sr-only">{p.name}</DialogTitle>
          {img && <img src={img.url} alt={p.name} className="max-h-[85vh] w-full rounded-xl object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
