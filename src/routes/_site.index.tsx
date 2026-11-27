import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Layers, Leaf, Palette, PenTool, Sparkles, Tag, Globe2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/nre/Reveal";
import { SectionHeading } from "@/components/nre/SectionHeading";
import { ProductCard } from "@/components/nre/ProductCard";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { useQuote } from "@/components/site/QuoteDrawer";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { canPrefetch } from "@/config/flags";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { ClientLogos, HomeProcess, SustainabilityBanner } from "@/components/site/TrustSections";
import { pageHead } from "@/lib/seo";

const TITLE = "NR Enterprise — All Kinds of Garments Accessories";
const DESC = "Labels, tags, stickers and trims for garment factories, buying houses and brands. Woven labels, hangtags, thread, elastic, drawcords and buttons from Dhaka.";

export const Route = createFileRoute("/_site/")({
  loader: async ({ context }) => { if (canPrefetch()) await context.queryClient.ensureQueryData(productsQuery({ featured: 1, per_page: 8 })); },
  head: () => pageHead(TITLE, DESC, "/"),
  component: Home,
});

const HERO_SLIDES = [
  { head: "All kinds of garments accessories,", accent: "under one roof.", sub: "Labels, tags, stickers and trims for garment factories, buying houses and brands." },
  { head: "Woven labels & hangtags", accent: "that carry your brand.", sub: "Custom artwork, die cut, emboss and foil finishing, matched to your approved sample." },
  { head: "Buttons, thread & zippers", accent: "ready for every line.", sub: "Metal snaps, shell buttons, sewing thread, elastic and drawcords from one trusted supplier." },
  { head: "From brief to delivery,", accent: "on time, every time.", sub: "One team for artwork, production, quality check and delivery to your factory." },
] as const;
const HERO_MS = 3000;

function HeroSection({ openQuote }: { openQuote: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % HERO_SLIDES.length), HERO_MS);
    return () => window.clearInterval(t);
  }, []);
  const s = HERO_SLIDES[i]!;
  return (
    <section className="relative isolate flex min-h-[88svh] items-center overflow-hidden bg-ink-green text-on-dark">
      <video className="hero-video absolute inset-0 -z-20 size-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/assets/site/hero-poster.jpg" aria-hidden="true" tabIndex={-1}>
        <source src="/assets/site/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/20" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-24 md:py-32">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur sm:text-xs"><BadgeCheck className="size-4 text-primary" />Garments trims & accessories</p>
        <div className="min-h-[15rem] max-w-3xl sm:min-h-[17rem] md:min-h-[19rem]" aria-live="polite">
          <h1 key={i} className="hero-line text-[2rem] font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {s.head} <span className="text-primary">{s.accent}</span>
          </h1>
          <p key={`s${i}`} className="hero-sub mt-5 max-w-xl text-base text-white/80 sm:text-lg">{s.sub}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="shadow-lift"><Link to="/products">Explore Products <ArrowRight /></Link></Button>
          <Button size="lg" variant="onDark" className="backdrop-blur" onClick={openQuote}>Request a Quote</Button>
        </div>
        <div className="mt-10 flex max-w-xs gap-2" role="tablist" aria-label="Headlines">
          {HERO_SLIDES.map((_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Headline ${n + 1}`} onClick={() => setI(n)} className="group h-6 flex-1 cursor-pointer">
              <span className="relative block h-1 overflow-hidden rounded-full bg-white/25">
                {n < i && <span className="absolute inset-0 bg-primary" />}
                {n === i && <span key={`p${i}`} className="hero-progress absolute inset-0 block bg-primary" />}
              </span>
            </button>
          ))}
        </div>
      </div>
      <a href="#trust" aria-label="Scroll down" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/70 md:block"><ChevronDown className="scroll-cue size-7" /></a>
    </section>
  );
}

const TRUST = [
  { icon: Tag, label: "Labels · Tags · Trims", text: "Everything for your garment line" },
  { icon: Palette, label: "Custom finishing", text: "Die cut, emboss, foil, varnish" },
  { icon: Leaf, label: "Recycled-quality materials", text: "Eco-friendly options available" },
  { icon: Globe2, label: "Supplying global brands", text: "Trusted by leading buyers" },
];

const ABOUT_FEATURES = [
  { icon: Layers, title: "One supplier", text: "Range under one roof" },
  { icon: Handshake, title: "Sample support", text: "Artwork and sample help" },
  { icon: Sparkles, title: "Custom finish", text: "Matched to your brand" },
];

const WHY_LIST = ["Wide product range under one roof", "Custom finishing on labels and tags", "Sustainable and recycled-quality material focus", "Sample and artwork support", "Professional support at every step"];

function Home() {
  const { openQuote } = useQuote();
  const featured = useQuery(productsQuery({ featured: 1, per_page: 8 }));
  const { data: categories = [] } = useQuery(categoriesQuery());

  return (
    <>
      {/* 1 Hero */}
      <HeroSection openQuote={() => openQuote()} />

      {/* 2 Trust strip */}
      <section id="trust" className="border-b bg-cream/60">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-7 lg:grid-cols-4 lg:gap-6">
          {TRUST.map((t, ti) => <Reveal as="li" delay={ti * 80} key={t.label} className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/20 text-secondary"><t.icon className="size-6" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold leading-tight">{t.label}</span><span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.text}</span></span>
          </Reveal>)}
        </ul>
      </section>

      {/* 3 About */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-2 lg:gap-16">
        <Reveal className="relative mx-auto w-full max-w-xl">
          <span className="absolute -left-3 -top-3 h-14 w-24 rounded-2xl bg-primary/70" aria-hidden />
          <span className="absolute -bottom-3 -right-3 h-20 w-10 rounded-2xl bg-primary/70" aria-hidden />
          <div className="relative grid grid-cols-5 grid-rows-[auto] gap-3 sm:gap-4">
            <img src="/assets/products/metal-snap-buttons/metal-snap-buttons-1.jpg" alt="Metal snap buttons" loading="lazy" className="col-span-2 aspect-square w-full rounded-3xl object-cover shadow-soft" />
            <img src="/assets/products/sewing-thread/sewing-thread-1.jpg" alt="Sewing thread" loading="lazy" className="col-span-3 aspect-[4/3] w-full self-start rounded-3xl object-cover shadow-lift" />
            <img src="/assets/products/woven-labels/woven-labels-2.jpg" alt="Woven labels" loading="lazy" className="col-span-3 aspect-[4/3] w-full rounded-3xl object-cover shadow-lift" />
            <img src="/assets/products/woven-labels/woven-labels-1.jpg" alt="Brand labels" loading="lazy" className="col-span-2 aspect-square w-full self-end rounded-3xl object-cover shadow-soft" />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">About NR Enterprise</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">Your trusted partner in garment accessories</h2>
          <p className="mt-4 text-muted-foreground md:text-lg">We supply labels, tags, stickers and trims to garment factories, buying houses and brands, with consistent quality and support from artwork to delivery.</p>
          <div className="mt-7 grid grid-cols-3 gap-3">
            {ABOUT_FEATURES.map((f) => <div key={f.title} className="rounded-2xl border bg-card p-3 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-4"><f.icon className="mx-auto size-7 text-primary" /><p className="mt-2 text-sm font-semibold leading-tight">{f.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{f.text}</p></div>)}
          </div>
          <Button asChild size="lg" className="mt-8 shadow-lift"><Link to="/about">Learn More <ArrowRight /></Link></Button>
        </Reveal>
      </section>

      {/* 4 Product range */}
      <section className="bg-cream/60 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Our product range</p><h2 className="mt-3 text-2xl font-bold tracking-tight md:text-4xl">Complete garment accessories solution</h2><p className="mt-3 text-sm text-muted-foreground md:text-base">From labels and tags to thread and trims, everything you need for apparel production.</p></Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
            {categories.map((c, ci) => (
              <Reveal key={c.slug} delay={ci * 110}><Link to="/products/$categorySlug" params={{ categorySlug: c.slug }} className="group relative block h-full overflow-hidden rounded-3xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <div className="aspect-[16/11] overflow-hidden"><img src={c.image_url} alt={c.name} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" /></div>
                <div className="relative p-5 pt-8 sm:p-6 sm:pt-9">
                  <span className="absolute -top-6 left-5 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lift sm:left-6"><Tag className="size-5" /></span>
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold leading-tight">{c.name}</h3><p className="mt-1 text-xs font-medium text-secondary">{c.product_count} products</p></div>
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/25 text-secondary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground"><ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span></div>
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                </div>
              </Link></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 5 Featured */}
      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="Featured" title="Popular with our buyers" />
            <Button asChild variant="link"><Link to="/products">View all products <ArrowRight /></Link></Button>
          </Reveal>
          <div className="mt-10">
            {featured.isLoading ? <LoadingSkeleton variant="cards" rows={4} /> : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{featured.data?.data.map((p, pi) => <Reveal key={p.id} delay={(pi % 4) * 90}><ProductCard product={p} /></Reveal>)}</div>
            )}
          </div>
        </div>
      </section>

      {/* 6 Why NR */}
      <section className="relative isolate overflow-hidden bg-ink-green text-on-dark">
        <div className="grid lg:grid-cols-2">
          <Reveal className="relative z-10 px-4 py-14 md:py-20 lg:pl-[max(1rem,calc((100vw-80rem)/2+1rem))] lg:pr-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Why choose NR Enterprise</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">More than a supplier,<br />a long-term partner</h2>
            <ul className="mt-7 space-y-3.5">
              {WHY_LIST.map((w) => <li key={w} className="flex items-start gap-3 text-sm md:text-base"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>{w}</li>)}
            </ul>
            <Button asChild size="lg" className="mt-8 shadow-lift"><Link to="/capabilities">Our Capabilities <ArrowRight /></Link></Button>
          </Reveal>
          <div className="relative min-h-64 lg:min-h-[28rem]">
            <img src="/assets/site/sewing-floor.jpg" alt="Sewing line in a garment factory" loading="lazy" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-ink-green via-transparent to-transparent lg:bg-gradient-to-r" aria-hidden />
            <span className="absolute -left-6 top-0 hidden h-full w-3 -skew-x-12 bg-primary lg:block" aria-hidden />
          </div>
        </div>
      </section>

      <HomeProcess />
      <SustainabilityBanner />
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
