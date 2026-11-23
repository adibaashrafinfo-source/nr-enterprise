import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Layers, Leaf, Palette, PenTool, Sparkles, Tag, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/nre/SectionHeading";
import { ProductCard } from "@/components/nre/ProductCard";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { useQuote } from "@/components/site/QuoteDrawer";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { canPrefetch } from "@/config/flags";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { ClientLogos, ProcessStrip, SustainabilityBand } from "@/components/site/TrustSections";
import { pageHead } from "@/lib/seo";

const TITLE = "NR Enterprise — All Kinds of Garments Accessories";
const DESC = "Labels, tags, stickers and trims for garment factories, buying houses and brands. Woven labels, hangtags, thread, elastic, drawcords and buttons from Dhaka.";

export const Route = createFileRoute("/_site/")({
  loader: async ({ context }) => { if (canPrefetch()) await context.queryClient.ensureQueryData(productsQuery({ featured: 1, per_page: 8 })); },
  head: () => pageHead(TITLE, DESC, "/"),
  component: Home,
});

const HERO = [
  ["/assets/products/woven-labels/woven-labels-1.jpg", "Woven labels"],
  ["/assets/products/offset-printed-tags/offset-printed-tags-1.jpg", "Printed hangtags"],
  ["/assets/products/sewing-thread/sewing-thread-1.jpg", "Sewing thread"],
  ["/assets/products/metal-snap-buttons/metal-snap-buttons-1.jpg", "Metal snap buttons"],
] as const;

const TRUST = [
  { icon: Tag, label: "Labels · Tags · Trims" },
  { icon: Palette, label: "Custom finishing" },
  { icon: Leaf, label: "Recycled-quality materials" },
  { icon: Globe2, label: "Supplying global brands" },
];

const WHY = [
  { icon: Layers, title: "Wide range under one roof", text: "Labels, tags, stickers, thread, elastic, cords and buttons from a single supplier." },
  { icon: Sparkles, title: "Custom finishing", text: "Die cut, emboss, foil, varnish and folds on labels and tags." },
  { icon: Leaf, title: "Sustainable materials focus", text: "Recycled-quality yarns, papers and fabrics where your brand needs them." },
  { icon: PenTool, title: "Sample and artwork support", text: "Send your artwork or a sample and we help you get it right." },
];

function Home() {
  const { openQuote } = useQuote();
  const featured = useQuery(productsQuery({ featured: 1, per_page: 8 }));
  const { data: categories = [] } = useQuery(categoriesQuery());

  return (
    <>
      {/* 1 Hero */}
      <section className="relative overflow-hidden bg-cream">
        <div className="nr-dotted absolute inset-y-0 right-0 w-2/3 opacity-70" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div className="animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-secondary shadow-soft"><BadgeCheck className="size-4" />Garments trims & accessories</p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">All kinds of garments accessories, <span className="relative inline-block">under one roof.<span className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-primary/70 -z-10" aria-hidden /></span></h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">Labels, tags, stickers and trims for garment factories, buying houses and brands.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/products">Explore Products <ArrowRight /></Link></Button>
              <Button size="lg" variant="outline" onClick={() => openQuote()}>Request a Quote</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {HERO.map(([src, alt], i) => (
              <div key={src} className={`overflow-hidden rounded-2xl bg-background shadow-lift animate-fade-up ${i % 2 ? "translate-y-8" : ""}`} style={{ animationDelay: `${i * 90}ms` }}>
                <img src={src} alt={alt} className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2 Trust strip */}
      <section className="border-y bg-background">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 md:grid-cols-4">
          {TRUST.map((t) => <li key={t.label} className="flex items-center gap-3 text-sm font-medium"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-secondary"><t.icon className="size-5" /></span>{t.label}</li>)}
        </ul>
      </section>

      {/* 3 Categories */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <SectionHeading eyebrow="What we supply" title="Three ranges, one supplier" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {categories.map((c) => (
            <Link key={c.slug} to="/products/$categorySlug" params={{ categorySlug: c.slug }} className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift">
              <div className="aspect-[4/3] overflow-hidden"><img src={c.image_url} alt={c.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
              <div className="p-6">
                <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{c.name}</h3><span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">{c.product_count} products</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary">Explore <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4 Featured */}
      <section className="bg-cream py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Featured" title="Popular with our buyers" />
            <Button asChild variant="link"><Link to="/products">View all products <ArrowRight /></Link></Button>
          </div>
          <div className="mt-10">
            {featured.isLoading ? <LoadingSkeleton variant="cards" rows={4} /> : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{featured.data?.data.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            )}
          </div>
        </div>
      </section>

      {/* 5 Why NR */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Why NR Enterprise" title="We blend People, Process & Technology to meet customer demand" />
          <img src="/assets/site/people-process-technology.jpg" alt="People, process and technology" loading="lazy" className="mt-8 w-full max-w-md rounded-2xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w) => (
            <div key={w.title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><w.icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <ProcessStrip />
      <SustainabilityBand />
      <ClientLogos marquee />

      {/* 9 Quote CTA */}
      <QuoteCta />
    </>
  );
}

function QuoteCta() {
  return <section className="relative overflow-hidden bg-ink-green text-on-dark">
    <div className="nr-dotted absolute inset-0 opacity-30" aria-hidden />
    <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
      <div><h2 className="text-3xl font-bold md:text-4xl">Make your brand's product stand out.</h2><p className="mt-4 max-w-md opacity-80">Tell us what you need. We reply with options, samples and a quote.</p><Button asChild variant="onDark" className="mt-6"><Link to="/contact">Request a detailed quote <ArrowRight /></Link></Button></div>
      <div className="rounded-2xl bg-background p-6 text-foreground shadow-lift"><EnquiryForm compact /></div>
    </div>
  </section>;
}
