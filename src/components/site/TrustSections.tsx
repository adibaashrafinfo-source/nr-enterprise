import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Palette, PackageCheck, ScanLine, Truck, Minimize2, Repeat2, Recycle, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/nre/SectionHeading";
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
  return <section className="border-y bg-cream py-16"><div className="mx-auto max-w-7xl px-4"><SectionHeading eyebrow="From brief to delivery" title="Every detail, every step" /><ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{PROCESS.map((step, i) => <li key={step.title} className="relative"><div className="mb-4 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"><step.icon className="size-5" /></span><span className="text-sm font-semibold text-muted-foreground">0{i + 1}</span>{i < 4 && <ArrowRight className="ml-auto hidden size-5 text-muted-foreground lg:block" />}</div><h3 className="font-semibold">{step.title}</h3>{detailed && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.text}</p>}</li>)}</ol></div></section>;
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
