import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Leaf, ClipboardList, Palette, PackageCheck, ScanLine, Truck, Minimize2, Repeat2, Recycle, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/nre/SectionHeading";
import { Reveal } from "@/components/nre/Reveal";
import { cn } from "@/lib/utils";
import { certificationsQuery, clientsQuery } from "@/lib/queries";

export const PROCESS = [
  { icon: ClipboardList, title: "Brief", text: "Share your product, artwork, quantity and delivery requirements so we can understand your brand's needs." },
  { icon: Palette, title: "Artwork & approval", text: "We help refine the artwork and sample details, confirming colours, materials and finishing before production." },
  { icon: PackageCheck, title: "Production", text: "The approved brief guides the supply and production of your labels, tags and trims." },
  { icon: ScanLine, title: "Quality check", text: "We review the finished accessories against your approved sample, specification and product information." },
  { icon: Truck, title: "Delivery", text: "We coordinate packing and delivery around your agreed requirements and keep your team informed." },
];
export const FOUR_R = [
  { icon: Minimize2, title: "Reduce", text: "Choose materials and processes thoughtfully to reduce unnecessary resource use and waste." },
  { icon: Repeat2, title: "Reuse", text: "Extend the useful life of materials wherever practical across the supply chain." },
  { icon: Recycle, title: "Recycle", text: "Explore recycled-quality yarns, papers and fabrics for your brand's accessories." },
  { icon: Sprout, title: "Recover", text: "Support responsible recovery of resources rather than letting valuable materials go to waste." },
];
export function PageBanner({ title, text }: { title: string; text?: string }) {
  return <section className="relative overflow-hidden border-b bg-cream"><div className="nr-dotted absolute inset-y-0 right-0 w-1/2 opacity-50" aria-hidden="true" /><div className="relative mx-auto max-w-7xl px-4 py-14 md:py-18"><nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"><Link to="/">Home</Link><span aria-hidden="true">/</span><span>{title}</span></nav><h1 className="text-3xl font-bold md:text-4xl">{title}</h1>{text && <p className="mt-4 max-w-2xl text-muted-foreground">{text}</p>}</div></section>;
}
export function ProcessStrip({ detailed = false }: { detailed?: boolean }) {
  return <section className="border-y bg-cream py-12 md:py-16"><div className="mx-auto max-w-7xl px-4"><Reveal><SectionHeading eyebrow="From brief to delivery" title="Every detail, every step" /></Reveal>
    <ol className={detailed ? "mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5" : "mt-8 grid grid-cols-6 gap-x-2 gap-y-7 sm:gap-x-4 md:mt-10 lg:grid-cols-5 lg:gap-6"}>
      {PROCESS.map((step, i) => <Reveal as="li" delay={i * 90} key={step.title} className={cn("relative", !detailed && "col-span-2 text-center lg:col-span-1 lg:text-left", !detailed && i === 3 && "col-start-2 lg:col-start-auto")}>
        <div className={cn("mb-3 flex items-center gap-3", !detailed && "flex-col gap-1.5 lg:flex-row lg:gap-3")}>
          <span className={cn("grid place-items-center rounded-full bg-primary text-primary-foreground shadow-soft", detailed ? "size-12" : "size-11 lg:size-12")}><step.icon className="size-5" /></span>
          <span className="text-xs font-semibold text-muted-foreground sm:text-sm">0{i + 1}</span>
          {i < 4 && <ArrowRight className="ml-auto hidden size-5 text-muted-foreground lg:block" />}
        </div>
        <h3 className={cn("font-semibold", !detailed && "text-sm leading-tight sm:text-base")}>{step.title}</h3>
        {detailed && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.text}</p>}
      </Reveal>)}
    </ol></div></section>;
}
export function SustainabilityBand() {
  return <section className="bg-primary py-14 text-primary-foreground"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="mb-4 text-sm font-medium">Responsible choices. Lasting impact.</p><div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap">{FOUR_R.map((r) => <div key={r.title} className="flex items-center gap-2 text-xl font-semibold"><r.icon className="size-6" />{r.title}</div>)}</div><p className="mt-5 max-w-2xl text-sm">Thoughtful material choices for brands that care about people and the planet.</p></div><Button asChild variant="outline" className="self-start border-primary-foreground bg-transparent"><Link to="/sustainability">Our approach <ArrowRight /></Link></Button></div></section>;
}
export function ClientLogos({ marquee = false }: { marquee?: boolean }) {
  const { data: clients = [], isError } = useQuery(clientsQuery());
  if (!clients.length) return isError ? <p role="alert" className="py-6 text-sm text-muted-foreground">Client information is currently unavailable.</p> : null;
  if (!marquee) return <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">{clients.map((c) => <div key={c.id} className="group flex aspect-[3/2] items-center justify-center rounded-2xl border bg-card p-6"><img src={c.logo_url} alt={c.name} loading="lazy" className="max-h-20 w-full object-contain grayscale transition-[filter] group-hover:grayscale-0" /></div>)}</div>;
  return <section className="overflow-hidden py-16"><div className="mx-auto max-w-7xl px-4"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="Our clients" title="Trusted by leading brands" /><Button asChild variant="link"><Link to="/clients">All clients <ArrowRight /></Link></Button></div><div className="client-marquee overflow-hidden"><div className="client-track flex w-max gap-6">{[0, 1].map((copy) => <div key={copy} className="flex shrink-0 gap-6" aria-hidden={copy === 1 ? true : undefined}>{clients.map((c) => <div key={c.id} className="group flex h-28 w-44 items-center justify-center rounded-2xl border p-5"><img src={c.logo_url} alt={copy === 0 ? c.name : ""} loading="lazy" className="max-h-16 w-full object-contain grayscale transition-[filter] group-hover:grayscale-0" /></div>)}</div>)}</div></div></div></section>;
}
export function Certifications() {
  const { data: certificates = [] } = useQuery(certificationsQuery());
  if (!certificates.length) return null;
  return <section className="mx-auto max-w-7xl px-4 py-16"><SectionHeading title="Certifications" /><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{certificates.map((c) => <div key={c.id} className="rounded-2xl border p-5">{c.image_url && <img src={c.image_url} alt={c.name} loading="lazy" className="mb-4 h-48 w-full object-contain" />}<h3 className="font-semibold">{c.name}</h3></div>)}</div></section>;
}
export function ContactCta({ title = "Talk to our team" }: { title?: string }) {
  return <section className="bg-ink-green py-14 text-on-dark"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-semibold md:text-3xl">{title}</h2><p className="mt-3 text-sm opacity-80">Labels, tags and trims tailored to your brand.</p></div><Button asChild><Link to="/contact">Request a Quote <ArrowRight /></Link></Button></div></section>;
}

export function HomeProcess() {
  return <section className="bg-background py-14 md:py-20"><div className="mx-auto max-w-7xl px-4">
    <Reveal className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Our process</p><h2 className="mt-3 text-2xl font-bold tracking-tight md:text-4xl">A simple & reliable supply process</h2><p className="mt-3 text-sm text-muted-foreground md:text-base">From brief to delivery, one team keeps every step clear and on schedule.</p></Reveal>
    <ol className="relative mt-10 grid grid-cols-6 gap-x-2 gap-y-8 sm:gap-x-4 md:mt-14 lg:grid-cols-5">
      <span className="absolute left-[10%] right-[10%] top-7 hidden border-t-2 border-dashed border-primary/60 lg:block" aria-hidden />
      {PROCESS.map((step, i) => <Reveal as="li" delay={i * 100} key={step.title} className={cn("relative col-span-2 text-center lg:col-span-1", i === 3 && "col-start-2 lg:col-start-auto")}>
        <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift ring-8 ring-background"><step.icon className="size-6" /><span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">{i + 1}</span></span>
        <h3 className="mt-4 text-sm font-semibold leading-tight sm:text-base">{step.title}</h3>
        <p className="mx-auto mt-2 hidden max-w-[16rem] text-sm leading-relaxed text-muted-foreground md:block">{step.text.split(". ")[0]!.replace(/\.$/, "")}.</p>
      </Reveal>)}
    </ol></div></section>;
}

export function SustainabilityBanner() {
  return <section className="mx-auto max-w-7xl px-4 pb-14 md:pb-20"><Reveal>
    <div className="relative isolate overflow-hidden rounded-3xl bg-ink-green text-on-dark shadow-lift">
      <img src="/assets/site/sustainability-banner.jpg" alt="" loading="lazy" className="absolute inset-0 -z-20 size-full object-cover object-right" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0f3a22]/95 via-[#0f3a22]/80 to-transparent" aria-hidden />
      <div className="flex flex-col gap-5 px-6 py-9 sm:flex-row sm:items-center sm:gap-8 sm:px-10 md:py-12">
        <span className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-white/40 text-white"><Leaf className="size-8" /></span>
        <div className="max-w-xl"><h2 className="text-2xl font-bold md:text-3xl">Sustainable & responsible sourcing</h2><p className="mt-2 text-sm text-white/85 md:text-base">Thoughtful material choices and recycled-quality options for brands that care about people and the planet.</p></div>
        <Button asChild variant="onDark" className="self-start sm:ml-auto sm:self-center"><Link to="/sustainability">Our approach <ArrowRight /></Link></Button>
      </div>
    </div>
  </Reveal></section>;
}
