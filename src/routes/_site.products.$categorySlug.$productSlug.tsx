import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Leaf, MessageCircle, PackageCheck, Palette, ShieldCheck, Truck, ZoomIn } from "lucide-react";
import { Reveal } from "@/components/nre/Reveal";
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
import { canonicalUrl, ogImageUrl, SITE_URL } from "@/lib/seo";
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
    if (!loaderData) return { meta: [{ title: "Product — NR Enterprise" }, { name: "description", content: "Garment trims and accessories from NR Enterprise." }, { property: "og:title", content: "Product — NR Enterprise" }, { property: "og:description", content: "Garment trims and accessories from NR Enterprise." }, { property: "og:type", content: "product" }, { property: "og:image", content: ogImageUrl() }, { name: "twitter:image", content: ogImageUrl() }, { name: "twitter:card", content: "summary_large_image" }], links };
    const title = `${loaderData.name} (${loaderData.code}) — NR Enterprise`;
    const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: loaderData.name, sku: loaderData.code, description: loaderData.description, category: loaderData.category, ...(loaderData.image ? { image: loaderData.image } : {}), brand: { "@type": "Organization", name: "NR Enterprise" } };
    const shareImg = loaderData.image ? (loaderData.image.startsWith("http") ? loaderData.image : `${SITE_URL}${loaderData.image}`) : ogImageUrl();
    return {
      meta: [{ title }, { name: "description", content: loaderData.description }, { property: "og:title", content: title }, { property: "og:description", content: loaderData.description }, { property: "og:type", content: "product" }, { property: "og:image", content: shareImg }, { name: "twitter:image", content: shareImg }, { name: "twitter:card", content: "summary_large_image" }],
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
        <nav className="mb-6 flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground" aria-label="Breadcrumb"><Link to="/products/$categorySlug" params={{ categorySlug: p.category.slug }} className="mr-2 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold text-secondary hover:bg-accent md:hidden"><ArrowLeft className="size-3" />Back</Link>
          <Link to="/" className="hover:text-secondary">Home</Link> / <Link to="/products" className="hover:text-secondary">Products</Link> / <Link to="/products/$categorySlug" params={{ categorySlug: p.category.slug }} className="hover:text-secondary">{p.category.name}</Link> / <span className="text-foreground">{p.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <button type="button" onClick={() => setZoom(true)} className="group relative block w-full overflow-hidden rounded-3xl border bg-muted shadow-lift" aria-label="Zoom image">
              {img && <img key={img.id} src={img.url} alt={p.name} className="hero-line aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105" />}
              <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-2 text-xs font-semibold shadow-soft backdrop-blur"><ZoomIn className="size-4" />Zoom</span>
            </button>
            {p.images.length > 1 && <div className="mt-4 grid grid-cols-4 gap-3">
              {p.images.map((im, i) => (
                <button key={im.id} type="button" onClick={() => setActive(i)} aria-label={`Show image ${i + 1}`}
                  className={cn("overflow-hidden rounded-xl border-2 transition-all", i === active ? "border-primary shadow-soft" : "border-transparent opacity-70 hover:opacity-100")}>
                  <img src={im.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide">{p.category.name}</span>
              <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">Code {p.code}</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">{p.name}</h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">{p.short_description}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {p.features.map((f) => <li key={f} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-soft"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>{f}</li>)}
            </ul>
            {variantChips.length > 0 && (
              <div className="mt-6"><p className="mb-2 text-sm font-semibold">Available options</p><div className="flex flex-wrap gap-2">{variantChips.map((v) => <span key={v} className="rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium shadow-soft">{v}</span>)}</div></div>
            )}
            <div className="mt-8 rounded-3xl border bg-cream p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Minimum order</span><b className="text-base">{formatQty(p.moq, p.unit_code)}</b></div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="flex-1 shadow-lift" onClick={() => openQuote(p)}>Request a Quote</Button>
                {wa && <Button asChild size="lg" variant="outline" className="flex-1"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>}
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-4">
                {[[Palette, "Custom artwork"], [ShieldCheck, "Quality checked"], [PackageCheck, "Sample support"], [Truck, "On-time delivery"]].map(([Icon, t]) => { const I = Icon as typeof Palette; return <li key={t as string} className="flex items-center gap-1.5"><I className="size-4 shrink-0 text-secondary" />{t as string}</li>; })}
              </ul>
            </div>
          </div>
        </div>

        <Reveal><Tabs defaultValue="description" className="mt-12 md:mt-16">
          <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl bg-muted p-1.5 sm:w-auto sm:rounded-full">
            <TabsTrigger value="description" className="rounded-full data-[state=active]:bg-primary data-[state=active]:shadow-soft">Description</TabsTrigger>
            <TabsTrigger value="specs" className="rounded-full data-[state=active]:bg-primary data-[state=active]:shadow-soft">Specifications</TabsTrigger>
            {finishing.length > 0 && <TabsTrigger value="finishing" className="rounded-full data-[state=active]:bg-primary data-[state=active]:shadow-soft">Finishing options</TabsTrigger>}
            <TabsTrigger value="sustainability" className="rounded-full data-[state=active]:bg-primary data-[state=active]:shadow-soft">Sustainability</TabsTrigger>
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
        </Tabs></Reveal>
      </div>

      {p.related.length > 0 && (
        <section className="bg-cream py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="heading-bar text-2xl font-bold">Related products</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{p.related.map((r, ri) => <Reveal key={r.id} delay={ri * 90}><ProductCard product={r} /></Reveal>)}</div>
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
