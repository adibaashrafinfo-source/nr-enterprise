import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Menu, Phone } from "lucide-react";
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-20">
        <Link to="/" aria-label="NR Enterprise home"><Logo className="h-10 md:h-12" /></Link>

        <nav className="hidden items-center gap-6 text-sm font-medium lg:flex" aria-label="Main">
          <Link to="/" className="hover:text-secondary" activeOptions={{ exact: true }} activeProps={{ className: "text-secondary" }}>Home</Link>
          <div className="relative" onMouseEnter={() => setMega(true)} onMouseLeave={() => setMega(false)}>
            <Link to="/products" className="inline-flex items-center gap-1 py-7 hover:text-secondary" activeProps={{ className: "text-secondary" }}
              aria-expanded={mega} onFocus={() => setMega(true)}>
              Products <ChevronDown className="size-3.5" />
            </Link>
            {mega && (
              <div className="absolute left-1/2 top-full w-[760px] -translate-x-1/2 animate-fade-up rounded-2xl border bg-popover p-6 shadow-lift">
                <div className="grid grid-cols-3 gap-6">
                  {categories.map((c) => (
                    <div key={c.slug}>
                      <Link to="/products/$categorySlug" params={{ categorySlug: c.slug }} onClick={() => setMega(false)} className="heading-bar mb-3 block font-semibold hover:text-secondary">{c.name}</Link>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        {all?.data.filter((p) => p.category.slug === c.slug).map((p) => (
                          <li key={p.slug}><Link to="/products/$categorySlug/$productSlug" params={{ categorySlug: c.slug, productSlug: p.slug }} onClick={() => setMega(false)} className="hover:text-secondary">{p.name}</Link></li>
                        ))}
                      </ul>
                    </div>
                  ))}
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
