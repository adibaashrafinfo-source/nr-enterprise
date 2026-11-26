import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, ChevronDown, Layers, Leaf, Palette, PenTool, Sparkles, Tag, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/nre/Reveal";
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
      <HeroSection openQuote={() => openQuote()} />

      {/* 2 Trust strip */}
      <section id="trust" className="border-y bg-background">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 md:grid-cols-4">
          {TRUST.map((t) => <li key={t.label} className="flex items-center gap-3 text-sm font-medium"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-secondary"><t.icon className="size-5" /></span>{t.label}</li>)}
        </ul>
      </section>

      {/* 3 Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:py-20">
        <Reveal><SectionHeading eyebrow="What we supply" title="Three ranges, one supplier" /></Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {categories.map((c, ci) => (
            <Reveal key={c.slug} delay={ci * 110}><Link to="/products/$categorySlug" params={{ categorySlug: c.slug }} className="group block h-full overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <div className="aspect-[4/3] overflow-hidden"><img src={c.image_url} alt={c.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
              <div className="p-6">
                <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{c.name}</h3><span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">{c.product_count} products</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-secondary">Explore <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link></Reveal>
          ))}
        </div>
      </section>

      {/* 4 Featured */}
      <section className="bg-cream py-16 md:py-20">
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

      {/* 5 Why NR */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:py-20 lg:grid-cols-2">
        <Reveal>
          <SectionHeading eyebrow="Why NR Enterprise" title="We blend People, Process & Technology to meet customer demand" />
          <img src="/assets/site/people-process-technology.jpg" alt="People, process and technology" loading="lazy" className="mt-8 w-full max-w-md rounded-2xl" />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {WHY.map((w, wi) => (
            <Reveal key={w.title} delay={wi * 90} className="rounded-2xl border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><w.icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{w.text}</p>
            </Reveal>
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
