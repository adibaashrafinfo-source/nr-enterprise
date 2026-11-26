import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Binary, Cable, ChevronDown, CircleDot, Circle, Cog, Disc3, Flame, Layers, Menu, Nfc, Package, Phone, Printer, Ribbon, ScanBarcode, Scissors, Shell, Shirt, Spool, Sticker, StickyNote, Tag, Tags, Waves, WashingMachine, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/nre/Logo";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/queries";
import { telHref } from "@/lib/contact";
import { useQuote } from "./QuoteDrawer";

const NAV = [
  { to: "/about", label: "About" },
  { to: "/capabilities", label: "Capabilities" },
  { to: "/sustainability", label: "Sustainability" },
  { to: "/clients", label: "Clients" },
  { to: "/contact", label: "Contact" },
] as const;

const PRODUCT_ICON: Record<string, LucideIcon> = {
  "woven-labels": Shirt, "printed-care-labels": WashingMachine, "screen-printed-labels": Layers,
  "offset-printed-tags": Tag, "digital-printed-tags": Printer, "thermal-stickers": Flame, "barcode-labels": ScanBarcode, "rfid-labels-tags": Nfc,
  "variable-data-labels": Binary, "flexo-adhesive-labels": Sticker, "adhesive-labels-tags": StickyNote,
  "sewing-thread": Spool, elastic: Waves, "twill-tape": Ribbon, "drawstring-cord": Cable, "cord-stoppers": CircleDot,
  "metal-snap-buttons": Disc3, "plastic-buttons": Circle, "shell-buttons": Shell,
};
const CATEGORY_ICON: Record<string, LucideIcon> = { labels: Tag, "tags-stickers-tracking": Tags, trims: Scissors };

export function SiteHeader() {
  const { data: settings } = useQuery(settingsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: all } = useQuery(productsQuery({ per_page: 48 }));
  const { openQuote } = useQuote();
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const phone = settings?.phones[0];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-20">
        <Link to="/" aria-label="NR Enterprise home"><Logo className="h-10 md:h-12" /></Link>

        <nav className="hidden items-center gap-6 text-sm font-medium lg:flex" aria-label="Main">
          <Link to="/" className="hover:text-secondary" activeOptions={{ exact: true }} activeProps={{ className: "text-secondary" }}>Home</Link>
          <div onMouseEnter={() => setMega(true)} onMouseLeave={() => setMega(false)}>
            <Link to="/products" className="inline-flex items-center gap-1 py-7 hover:text-secondary" activeProps={{ className: "text-secondary" }}
              aria-expanded={mega} onFocus={() => setMega(true)}>
              Products <ChevronDown className="size-3.5" />
            </Link>
            {mega && (
              <div className="absolute inset-x-0 top-full z-50 mx-auto w-[min(940px,92vw)] animate-fade-up overflow-hidden rounded-3xl border bg-popover shadow-lift ring-1 ring-black/5">
                <div className="h-1 bg-gradient-to-r from-primary via-primary to-secondary" aria-hidden />
                <div className="grid grid-cols-3 gap-x-5 gap-y-6 p-6">
                  {categories.map((c) => {
                    const CatIcon = CATEGORY_ICON[c.slug] ?? Package;
                    const items = all?.data.filter((p) => p.category.slug === c.slug) ?? [];
                    return (
                      <div key={c.slug}>
                        <Link to="/products/$categorySlug" params={{ categorySlug: c.slug }} onClick={() => setMega(false)} className="group/cat mb-3 flex items-center gap-3 rounded-2xl bg-cream p-3 transition-colors hover:bg-accent">
                          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground shadow-soft"><CatIcon className="size-5" /></span>
                          <span className="min-w-0 flex-1"><span className="block font-semibold leading-tight">{c.name}</span><span className="text-xs text-muted-foreground">{items.length} products</span></span>
                          <ArrowRight className="size-4 -translate-x-1 text-secondary opacity-0 transition-all group-hover/cat:translate-x-0 group-hover/cat:opacity-100" />
                        </Link>
                        <ul className="space-y-0.5">
                          {items.map((p) => {
                            const Icon = PRODUCT_ICON[p.slug] ?? Cog;
                            return (
                              <li key={p.slug}>
                                <Link to="/products/$categorySlug/$productSlug" params={{ categorySlug: c.slug, productSlug: p.slug }} onClick={() => setMega(false)}
                                  className="group/item flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-foreground/80 transition-all hover:bg-accent hover:text-foreground">
                                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-secondary transition-all group-hover/item:scale-110 group-hover/item:bg-primary group-hover/item:text-primary-foreground group-hover/item:shadow-soft"><Icon className="size-4" /></span>
                                  <span className="flex-1 leading-tight">{p.name}</span>
                                  <ArrowRight className="size-3.5 -translate-x-1 text-secondary opacity-0 transition-all group-hover/item:translate-x-0 group-hover/item:opacity-100" />
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-4 border-t bg-cream px-6 py-3.5 text-sm">
                  <span className="text-muted-foreground">Custom artwork, samples and low MOQ available on request.</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link to="/products" onClick={() => setMega(false)} className="inline-flex items-center gap-1.5 font-semibold text-secondary hover:underline">View all products <ArrowRight className="size-4" /></Link>
                    <button type="button" onClick={() => { setMega(false); openQuote(); }} className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary-hover hover:shadow-lift">Request a Quote</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {NAV.map((n) => <Link key={n.to} to={n.to} className="hover:text-secondary" activeProps={{ className: "text-secondary" }}>{n.label}</Link>)}
        </nav>

        <div className="flex items-center gap-3">
          {phone && <a href={telHref(phone)} className="hidden items-center gap-2 text-sm font-medium text-secondary xl:flex"><Phone className="size-4" />{phone}</a>}
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => openQuote()}>Request a Quote</Button>
          <Sheet open={mobile} onOpenChange={setMobile}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button></SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                <Link to="/" onClick={() => setMobile(false)} className="rounded-full px-4 py-2.5 font-medium hover:bg-accent">Home</Link>
                <Link to="/products" onClick={() => setMobile(false)} className="rounded-full px-4 py-2.5 font-medium hover:bg-accent">All products</Link>
                {categories.map((c) => (
                  <Link key={c.slug} to="/products/$categorySlug" params={{ categorySlug: c.slug }} onClick={() => setMobile(false)} className="rounded-full px-8 py-2 text-sm text-muted-foreground hover:bg-accent">{c.name}</Link>
                ))}
                {NAV.map((n) => <Link key={n.to} to={n.to} onClick={() => setMobile(false)} className="rounded-full px-4 py-2.5 font-medium hover:bg-accent">{n.label}</Link>)}
              </nav>
              <Button className="mt-6 w-full" onClick={() => { setMobile(false); openQuote(); }}>Request a Quote</Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
